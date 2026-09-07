import { buildSaintKate } from './saintKate';
import { SAINT_KATE_SITE } from './saintKateSite';
import { buildMarcusCampus } from './marcusCampus';
import { MARCUS_SITE, PECK_SITE } from './marcusSite';
import { buildPabstTheater } from './pabstTheater';
import { buildRiversideTheater } from './riversideTheater';
import { PABST_SITE, RIVERSIDE_SITE } from './theaterSites';
import { buildTurnerHall } from './turnerHall';
import { TURNER_HALL_SITE } from './turnerHallSite';
import {buildSummerfest} from './summerfest';
import {buildNewMuseumCampus} from './newMuseumCampus';
import {NEW_MUSEUM_SITE} from './newMuseumSite';
import {buildPortMilwaukee,PORT_FOCUS} from './portMilwaukee';
import { buildLighthouseSite } from './lighthouseSite';
import { buildDiscoveryWorld } from './discoveryWorld';
import { buildPublicMarket } from './publicMarket';
import { addPublicMarketSign } from './publicMarketSign';
import { buildLighthouse } from './lighthouse';
import { buildAmFam } from './amfam';
import { AMFAM_SITE, addAmFamNameSign, groundAmFamFoundation } from './amfamSite';
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Manifest } from './geo';
import { lonLatToLocal } from './geo';
import { buildHoan } from './hoan';
import { buildMuseumCampus } from './museumCampus';
import { buildLakefrontContext } from './lakefrontContext';
import { buildReimanBridge } from './reimanBridge';
import { buildDomes } from './domes';
import { DOMES_SITE, buildDomesServiceBuildings, groundDomesFoundations } from './domesSite';
import { buildCityHall } from './cityHall';
import { CITY_HALL_SITE } from './cityHallSite';
import { buildCouture } from './coutureCampus';
import { buildNM } from './nmCampus';
import { buildUsBankCampus } from './usBankCampus';
import { buildFiserv } from './fiserv';
import { buildDeerDistrict } from './deerDistrict';
import { buildDeerDistrictBuildings } from './deerDistrictBuildings';

/** Coordinates verified 2026-09-06 against OpenStreetMap via Nominatim (see data/landmarks_nominatim.json). */
export interface Landmark {
  id: string; name: string; lat: number; lon: number; osm: string; blurb: string;
  interpretive?: boolean; focusHeight?: number; /** camera: distance (m), azimuth (deg from north, clockwise), elevation (deg) */ view: [number, number, number]; labelHeight: number;
}
export const LANDMARKS: Landmark[] = [
  {id:'saintkate',name:'Saint Kate – The Arts Hotel',lat:SAINT_KATE_SITE.lat,lon:SAINT_KATE_SITE.lon,osm:'way/69020648',view:[135,35,24],labelHeight:41,focusHeight:17,interpretive:true,blurb:'The arts hotel on Kilbourn Avenue, with red-brick guest-room floors, pale arched window bands, a glazed entrance and red neon signs. The building follows its mapped footprint; architectural detail and lighting are interpreted from reference photographs.'},
  {id:'marcus',name:'Marcus Performing Arts Center',lat:MARCUS_SITE.lat,lon:MARCUS_SITE.lon,osm:'way/68762980',view:[215,125,30],labelHeight:35,focusHeight:14,interpretive:true,blurb:'The performing arts campus on Water Street: sculptural stone halls, a glazed public entrance, colored facade lighting, Peck Pavilion and landscaped community grounds. The north parking structure connects across State Street by skywalk. Details are interpreted from photographs and mapped footprints.'},
  {id:'peck',name:'Peck Pavilion',lat:PECK_SITE.lat,lon:PECK_SITE.lon,osm:'way/599981655',view:[85,125,18],labelHeight:12,focusHeight:4,interpretive:true,blurb:'The Marcus Center’s outdoor riverfront stage, with an open roof structure, fixed seating, and an adjoining lawn, honey locusts, cafe tables and public paths.'},
  {id:'pabst',name:'Pabst Theater',lat:PABST_SITE.lat,lon:PABST_SITE.lon,osm:'way/68649538',view:[105,155,18],labelHeight:32,focusHeight:13,interpretive:true,blurb:'Otto Strack’s 1895 theater on Wells Street. Ornamental brick and stone, a raised entrance pavilion, iron porch, balcony and dark mansard roof define this historic facade. The footprint is mapped; decorative details and heights are photo-based estimates.'},
  {id:'riverside',name:'Riverside Theater',lat:RIVERSIDE_SITE.lat,lon:RIVERSIDE_SITE.lon,osm:'way/68641417',view:[150,170,20],labelHeight:53,focusHeight:22,interpretive:true,blurb:'The 1928 theater occupies the Empire Building at Wisconsin Avenue and the Milwaukee River. Its projecting illuminated marquee and tall red blade sign mark the entrance below the office floors. The shared building follows its mapped footprint; facade details are interpreted from references.'},
  {id:'turnerhall',name:'Turner Hall Ballroom',lat:TURNER_HALL_SITE.lat,lon:TURNER_HALL_SITE.lon,osm:'way/69298480',view:[110,255,18],labelHeight:33,focusHeight:12,interpretive:true,blurb:'Henry C. Koch’s 1882–83 Cream City brick hall on Vel R. Phillips Avenue. Twin gables, a central roof tower, arched windows and red masonry bands frame the historic west entrance. The mapped footprint anchors this photo-based exterior; heights and fine details are approximate.'},
  {id:'newmuseum',name:'Nature & Culture Museum of Wisconsin',lat:NEW_MUSEUM_SITE.lat,lon:NEW_MUSEUM_SITE.lon,osm:'way/713732739',view:[200,235,20],labelHeight:42,focusHeight:17,interpretive:true,blurb:'Future completed visualization of the Nature & Culture Museum of Wisconsin at Sixth and McKinley, expected to open in early 2027. Ennead and Kahler Slater’s design uses rounded, offset volumes and sandstone-like concrete inspired by Mill Bluff. The construction parcel is mapped; building dimensions and fine details are interpreted from design renderings.'},
  {id:'port',name:'Port Milwaukee',lat:PORT_FOCUS.lat,lon:PORT_FOCUS.lon,osm:'#map=16/43.01746/-87.89554',view:[1100,100,33],labelHeight:55,focusHeight:16,interpretive:true,blurb:'Explore the cargo docks and rail yards of Jones Island, with waterfront sheds, bulk storage, cranes, a lake freighter and the Lake Express terminal. Tracks and buildings follow mapped geometry; equipment, vessels and fine architectural details are illustrative.'},
  { id: 'marquette', name: 'Marquette Interchange', lat: 43.0347, lon: -87.921, osm: '#map=16/43.0347/-87.921', view: [1100, 135, 43], labelHeight: 70, focusHeight: 22,
    blurb: 'The downtown junction of I-43, I-94, and I-794. Its ramps follow mapped road centerlines and bridge levels; deck elevations, shoulders, and pier locations are approximate.' },
  { id: 'usbank', name: 'U.S. Bank Center', lat: 43.0380951, lon: -87.9020403, osm: 'way/34901930', view: [420, 65, 20], labelHeight: 190, focusHeight: 91, interpretive: true,
    blurb: 'The 42-story, 601-foot tower by Skidmore, Owings & Merrill. A white aluminum frame, dark four-pane window groups and three exposed diagonal truss bands rise above the glass Galleria. The shaft and podium use mapped footprints; fine facade and signage details are interpreted from photographs.' },
  { id: 'couture', name: 'The Couture', lat: 43.037236, lon: -87.899477, osm: 'way/1300225285', view: [290, 45, 16], labelHeight: 168, focusHeight: 77, interpretive: true,
    blurb: 'The lakefront residential tower above The Hop’s transit concourse. Curved glass facades, pale floor bands and a stepped crown rise above the open streetcar hall and parking podium. Footprints follow mapped building parts; height and fine details are photo-based approximations.' },
  { id: 'nm', name: 'Northwestern Mutual Tower', lat: 43.04, lon: -87.90028, osm: 'way/392821857', view: [330, 120, 16], labelHeight: 174, focusHeight: 80, interpretive: true,
    blurb: 'The 32-story Tower and Commons, completed in 2017. A curved glass facade and crisp prow rise 169 meters above the lakefront campus, beside the low Commons and historic headquarters. Mapped building parts guide its footprint; facade details, signage and night occupancy are illustrative.' },
  { id: 'bmo', name: 'BMO Tower', lat: 43.0408146, lon: -87.9088259, osm: 'way/592527373', view: [220, 265, 25], labelHeight: 115, focusHeight: 85,
    blurb: 'The 25-story BMO Tower on North Water Street, with a BMO sign on its west-facing facade. Logo placement is approximate.' },
  { id: 'mam', name: 'Milwaukee Art Museum', lat: 43.0392813, lon: -87.8970116, osm: 'way/403894584', view: [245, 245, 24], labelHeight: 62, focusHeight: 20, interpretive: true,
    blurb: 'Santiago Calatrava’s Quadracci Pavilion (2001) with the Burke Brise Soleil, a movable sunscreen whose 217-foot wingspan opens and closes daily over the lakefront.' },
  { id: 'warmemorial', name: 'War Memorial Center', lat: 43.0404985801, lon: -87.8972942587, osm: 'way/403895414', view: [170, 285, 28], labelHeight: 32, focusHeight: 12,
    blurb: 'Eero Saarinen’s 1957 memorial beside the Art Museum: cantilevered upper floors, sculpted concrete piers, and an elevated Court of Honor with a reflecting pool. The west facade marks Edmund Lewandowski’s mosaic. Detailed dimensions and mural treatment are interpretive.' },
  { id: 'hoan', name: 'Hoan Bridge', lat: 43.0245, lon: -87.8985, osm: 'relation/16271476', view: [520, 95, 12], labelHeight: 74, focusHeight: 32, interpretive: true,
    blurb: 'I-794 crosses the harbor on a 600-foot main span. Yellow arches extend below the road to concrete piers, with steel framing beneath the deck and connected side spans. This miniature uses mapped alignment and photo-based structural details.' },
  { id: 'cityhall', name: 'Milwaukee City Hall', lat: 43.0417052, lon: -87.9097516, osm: 'way/66709384', view: [285, 240, 18], labelHeight: 122, focusHeight: 53, interpretive: true,
    blurb: 'Flemish Renaissance Revival seat of city government (1895). Its 353-foot clock tower was among the tallest habitable buildings in the world when completed.' },
  { id: 'fiserv', name: 'Fiserv Forum', lat: 43.0450096, lon: -87.9174871, osm: 'relation/10689047', view: [450, 120, 33], labelHeight: 45, focusHeight: 17, interpretive: true,
    blurb: 'Home of the Milwaukee Bucks since 2018. A sweeping zinc roof wraps around the arena beside a tall east-facing glass atrium and the projecting Panorama Club. Deer District connects its entrances to patterned plaza paving, a lawn, fountains, planted seating, and the covered Beer Garden passage. Mapped footprints anchor the surrounding restaurant buildings and The Trade hotel; facade details are interpreted from photographs.' },
  { id: 'amfam', name: 'American Family Field', lat: 43.0280619, lon: -87.9712694, osm: 'relation/5747956', view: [470, 305, 31], labelHeight: 110, focusHeight: 28, interpretive: true,
    blurb: 'Retractable fan-shaped-roof ballpark of the Milwaukee Brewers, opened in 2001 in the Menomonee Valley.' },
  { id: 'domes', name: 'Mitchell Park Domes', lat: 43.0263777, lon: -87.9454144, osm: 'way/54622334', view: [210, 227, 18], labelHeight: 34, focusHeight: 12, interpretive: true,
    blurb: 'Three beehive-shaped glass conservatories (1959–67), each about 140 feet across and 85 feet tall, housing tropical, desert and seasonal show gardens.' },
  { id: 'discovery', name: 'Discovery World', lat: 43.0369136, lon: -87.8961382, osm: 'way/55205380', view: [245, 125, 14], labelHeight: 24, focusHeight: 6, interpretive: true,
    blurb: 'A lakefront science museum with a rectangular Tech wing, circular Aqua building and glass Pilot House crowned by an open steel ring. The promenade connects the two wings beside a public boardwalk. Modeled from mapped building parts and architectural photographs; fine details and deck elevation are approximate.' },
  { id: 'lighthouse', name: 'North Point Lighthouse', lat: 43.0655738, lon: -87.8713923, osm: 'way/403385102', view: [115, 135, 16], labelHeight: 28, interpretive: true,
    blurb: 'A 74-foot steel tower (1888, raised 1912) in Lake Park, marking the bluff north of downtown; decommissioned in 1994 and now a museum.' },
  { id: 'basilica', name: 'Basilica of St. Josaphat', lat: 43.0023884, lon: -87.9191506, osm: 'way/663419192', view: [420, 200, 24], labelHeight: 78, interpretive: true,
    blurb: 'Polish-community basilica (1901) built with salvaged stone from the Chicago post office; its copper dome is among the largest in the United States.' },
  { id: 'thirdward', name: 'Historic Third Ward', lat: 43.0327715, lon: -87.9058425, osm: 'relation/5913975', view: [700, 170, 30], labelHeight: 40,
    blurb: 'Former warehouse district south of downtown, rebuilt after the 1892 fire and now a gallery, restaurant and riverwalk neighborhood.' },
  { id: 'summerfest', name: 'Summerfest grounds', lat: 43.0308639, lon: -87.8995549, osm: 'relation/8154902', view: [1080, 115, 43], labelHeight: 40, focusHeight: 12, interpretive: true,
    blurb: 'Henry Maier Festival Park: nine detailed stages, the amphitheater and BMO Pavilion, lakefront promenades, concessions and Community Park. The layout follows mapped footprints; roof heights, landscaping and festival lighting are interpreted from reference photographs.' },
  { id: 'market', name: 'Milwaukee Public Market', lat: 43.0352575, lon: -87.9080905, osm: 'way/53160687', view: [125, 230, 28], labelHeight: 20, focusHeight: 5, interpretive: true,
    blurb: 'TKWA’s 2005 market hall: cream brick, exposed steel, two-story glass, projecting sun shades and a west-facing neon name. Mapped footprint; facade and height details estimated from the architect’s photographs.' },
];

export interface LandmarkGeo { hoan: null | { centerline: [number, number][]; archCenter: [number, number]; archDir: [number, number]; spanM: number; lengthM: number; deckHeightM: number } }

const COPPER = new THREE.MeshLambertMaterial({ color: 0x7d6e5a });
const STONE = new THREE.MeshLambertMaterial({ color: 0xd9cdb6 });

function shadowed(m: THREE.Mesh) { m.castShadow = true; m.receiveShadow = true; return m; }

/** Interpretive, simplified silhouettes. Dimensions are approximate and documented in README. */
export function buildInterpretive(manifest: Manifest, geo: LandmarkGeo, groundAt: (x: number, z: number) => number): THREE.Group {
  const g = new THREE.Group();
  const at = (id: string) => { const l = LANDMARKS.find(l => l.id === id)!; const [x, z] = lonLatToLocal(manifest, l.lon, l.lat); return { x, z, y: groundAt(x, z) }; };

  const cityHall = buildCityHall();
  cityHall.position.set(CITY_HALL_SITE.x, CITY_HALL_SITE.floor, CITY_HALL_SITE.z);
  cityHall.rotation.y = CITY_HALL_SITE.bearing; g.add(cityHall);

  // Museum, memorial, bridge, raised park and garage form one connected lakefront campus.
  g.add(buildMuseumCampus(groundAt), buildReimanBridge(groundAt), buildLakefrontContext(groundAt));

  // Deck, arches, and supports share one distance-based alignment.
  if (geo.hoan) g.add(buildHoan(geo.hoan, groundAt));

  const domes = buildDomes();
  domes.position.set(DOMES_SITE.x, DOMES_SITE.floor, DOMES_SITE.z);
  domes.rotation.y = DOMES_SITE.bearing;
  groundDomesFoundations(domes, groundAt);
  g.add(domes, buildDomesServiceBuildings(groundAt));

  const amfam = buildAmFam(); addAmFamNameSign(amfam);
  amfam.position.set(AMFAM_SITE.x, AMFAM_SITE.floor, AMFAM_SITE.z);
  amfam.rotation.y = AMFAM_SITE.bearing; groundAmFamFoundation(amfam,groundAt); g.add(amfam);

  g.add(buildLighthouse(groundAt), buildLighthouseSite(groundAt));
  g.add(buildSummerfest(groundAt),buildDiscoveryWorld(groundAt),buildPortMilwaukee(groundAt),buildNewMuseumCampus(groundAt));
  g.add(buildCouture(groundAt));
  g.add(buildNM(groundAt), buildUsBankCampus(groundAt));
  g.add(buildMarcusCampus(groundAt),buildSaintKate(groundAt));
  g.add(buildTurnerHall(groundAt), buildPabstTheater(groundAt), buildRiversideTheater(groundAt));
  g.add(buildFiserv(groundAt), buildDeerDistrict(groundAt), buildDeerDistrictBuildings(groundAt));
  const market = buildPublicMarket(groundAt); addPublicMarketSign(market); g.add(market);

  // Basilica of St. Josaphat: drum + dome + lantern, two front towers with cupolas (on the pipeline's 14 m plinth)
  { const p = at('basilica'); const y = p.y + 14;
    const drum = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 12, 20), STONE)); drum.position.set(p.x, y + 6, p.z); g.add(drum);
    const dome = shadowed(new THREE.Mesh(new THREE.SphereGeometry(13.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), COPPER)); dome.position.set(p.x, y + 12, p.z); g.add(dome);
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 7, 10), STONE); lantern.position.set(p.x, y + 28, p.z); g.add(lantern);
    const lcap = new THREE.Mesh(new THREE.ConeGeometry(3, 3, 10), COPPER); lcap.position.set(p.x, y + 33, p.z); g.add(lcap);
    for (const s of [-1, 1]) { const tw = shadowed(new THREE.Mesh(new THREE.BoxGeometry(7, 22, 7), STONE)); tw.position.set(p.x + s * 20, y + 11 - 6, p.z - 30); g.add(tw);
      const cup = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), COPPER); cup.position.set(p.x + s * 20, y + 16, p.z - 30); g.add(cup); } }
  return g;
}

export function makeLabel(l: Landmark, x: number, y: number, z: number, onClick: (l: Landmark) => void): CSS2DObject {
  const el = document.createElement('button'); el.className = 'lm-label'; el.type = 'button'; el.textContent = l.name;
  el.setAttribute('aria-label', `Fly to ${l.name}`);
  el.addEventListener('click', (e) => { e.stopPropagation(); onClick(l); });
  const o = new CSS2DObject(el); o.position.set(x, y, z); o.center.set(0.5, 1.1); return o;
}
