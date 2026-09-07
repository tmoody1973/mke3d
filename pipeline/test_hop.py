"""Contract / provenance / directed-route importer regression checks."""
import csv,json,math,unittest
from pathlib import Path
from collections import Counter,defaultdict
from build_hop import OUT,DEFAULT_PACK,seconds,interpolate_times,distances,rows

class HopImporterTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.data=json.loads((OUT/'hop/network.json').read_text())
 def test_snapshot_counts_and_ids(self):
  d=self.data;self.assertEqual((len(d['paths']),len(d['stops']),len(d['trips']),len(d['calendars'])),(2,26,402,7))
  self.assertEqual(sum(len(t['stops'])for t in d['trips']),5988)
  for key in ('stops','trips','paths','calendars'):self.assertEqual(len({v['id']for v in d[key]}),len(d[key]))
 def test_distance_tables_closed_finite(self):
  for p in self.data['paths']:
   self.assertEqual(p['points'][0],p['points'][-1]);self.assertEqual(len(p['points']),len(p['distances']))
   self.assertAlmostEqual(p['length'],distances(p['points'])[-1],3)
   self.assertTrue(all(b>a for a,b in zip(p['distances'],p['distances'][1:])))
   self.assertTrue(all(math.isfinite(v)for point in p['points']for v in point))
   self.assertTrue(all(b-a<=3.01 for a,b in zip(p['distances'],p['distances'][1:])))
 def test_ordered_stops_and_schedule(self):
  paths={p['id']:p for p in self.data['paths']};stopids={s['id']for s in self.data['stops']}
  for t in self.data['trips']:
   self.assertTrue(t['blockId']);self.assertTrue(all(s['stopId']in stopids for s in t['stops']))
   for a,b in zip(t['stops'],t['stops'][1:]):
    self.assertGreater(b['distance'],a['distance']);self.assertGreaterEqual(b['arrival'],a['departure'])
   self.assertLessEqual(t['stops'][-1]['distance']-t['stops'][0]['distance'],paths[t['pathId']]['length']*1.05)
 def test_missing_times_bounded_only(self):
  self.assertEqual(sum(bool(s.get('inferred'))for t in self.data['trips']for s in t['stops']),75)
  self.assertEqual(interpolate_times([1,None,101],[0,20,100]),([1,21,101],[1]))
  with self.assertRaises(ValueError):interpolate_times([None,100],[0,10])
  with self.assertRaises(ValueError):interpolate_times([100,None],[0,10])
  self.assertEqual(seconds('25:01:02'),90062)
 def test_raw_identifiers_and_exact_known_timepoints(self):
  raw={r['trip_id']:r for r in rows(DEFAULT_PACK/'gtfs/current','trips.txt')}
  times=defaultdict(list)
  for r in rows(DEFAULT_PACK/'gtfs/current','stop_times.txt'):times[r['trip_id']].append(r)
  for t in self.data['trips']:
   r=raw[t['id']];self.assertEqual(t['blockId'],r['block_id']);self.assertEqual(t['serviceId'],r['service_id'])
   for a,b in zip(t['stops'],sorted(times[t['id']],key=lambda r:int(r['stop_sequence']))):
    if b['arrival_time']:self.assertEqual(a['arrival'],seconds(b['arrival_time']))
 def test_default_noon_four_distinct_blocks(self):
  d=self.data;active={c['id']for c in d['calendars']if c['start']<=d['defaultDate']<=c['end']and c['weekdays'][1]}
  cars=[t for t in d['trips']if t['serviceId']in active and t['stops'][0]['departure']<=43200<t['stops'][-1]['arrival']]
  self.assertEqual(len({t['blockId']for t in cars}),4)
 def test_gauge_and_shared_tracks(self):
  d=self.data;self.assertEqual(d['provenance']['gaugeM'],1.435);self.assertEqual(d['provenance']['gaugeEvidence']['wayCount'],38)
  self.assertTrue(any(len(t['routeIds'])==2 for t in d['physicalTracks']))
  signatures=[tuple(tuple(p)for p in t['points'])for t in d['physicalTracks']]
  self.assertEqual(len(set(signatures)),len(signatures))
  self.assertTrue(all(len(i['sha256'])==64 for i in d['provenance']['inputs']))

 def test_no_highway_jump_or_bridge_drop(self):
  for p in self.data['paths']:
   for a,b in zip(p['points'],p['points'][1:]):
    grade=abs(b[1]-a[1])/math.hypot(b[0]-a[0],b[2]-a[2])
    self.assertLess(grade,.21)
   for x,y,z in p['points']:
    if -110<x<-90 and -135<z<-110:self.assertLess(y,8)
    if -450<x<-375 and 4<z<30:self.assertGreater(y,1.8)
 def test_westbound_platform_uses_forward_visit(self):
  trip=next(t for t in self.data['trips']if t['id']=='TL-10')
  d={s['stopId']:s['distance']for s in trip['stops']}
  self.assertLess(d['TL-62'],4200);self.assertGreater(d['TL-62'],d['TL-61'])

 def test_rails_and_vehicle_paths_share_exact_heights(self):
  heights=defaultdict(set)
  for track in self.data['physicalTracks']:
   for x,y,z in track['points']:heights[x,z].add(y)
  for path in self.data['paths']:
   for x,y,z in path['points']:
    self.assertIn((x,z),heights)
    self.assertEqual(heights[x,z],{y})

if __name__=='__main__':unittest.main()
