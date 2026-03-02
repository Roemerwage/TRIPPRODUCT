import { Participant } from "@/types/trip";

// Map of participant id -> local avatar asset.
// Use static `require` calls so Metro bundler can include these images.
// If the file is not present, Metro will fail at build time — keep filenames in `/assets/crew`.
const AVATARS: Record<string, any> = {
  jasper: require('../assets/crew/Jasper.png'),
  rowan: require('../assets/crew/Rowan.png'),
  roemer: require('../assets/crew/Roemer.png'),
  daan: require('../assets/crew/Daan.png'),
  xander: require('../assets/crew/Xander.png'),
  derk: require('../assets/crew/Derk.png'),
  dost: require('../assets/crew/Julius.png'),
  tijs: require('../assets/crew/Tijs.png'),
  felix: require('../assets/crew/Felix.png'),
  olivier: require('../assets/crew/Olivier.png'),
};

export const PARTICIPANTS: Participant[] = [
  {
    id: "jasper",
    naam: "Jasper",
    bio: "Jasper is een corpsbal in vermomming: alternatief jasje, maar een das in de binnenzak. Hij liet zich aflebberen door een loopse dandy tijdens pride, tolerantieHij is hij wannabe DJ bij Club Continental, waar hij platen draait alsof papa niet alles betaalt. Als  praeses van het groenbestuur verwierf hij eeuwige roem met zijn iconische dansje: onnavolgbaar, onnodig en onvergetelijk. Jasper balanceert vakkundig tussen underground en bovenklasse, zonder echt te kiezen. Een man met smaak, steun en timing — vooral als de beat net verkeerd valt.",
    avatar: AVATARS.jasper,
    emergencyContacts: [
      { naam: "Marijn Snijders", telefoon: "+31 6 53154820" },
      { naam: "Mara Krouwels", telefoon: "+31 6 25308078" },
    ],
  },
  {
    id: "rowan",
    naam: "Rowan",
    bio: "Rowan is het schoolvoorbeeld van een corpsbal die te vroeg heeft gepiekt. Als foet Tarzan bezorgde hij menig vrouwelijke lid knikkende knietjes. Vrijwel direct na de eerste sneeuwval schaatste Brandon een scheve schaats. Sindsdien heeft hij zijn toenmalige vriendin ingeruild voor een heus model, waar hij naar verluidt vaker is dan in zijn eigen huis. Zijn baan bij Vibe Groep heeft hij recent achter zich gelaten, wat bleek… niet helemaal de vibe. ",
    avatar: AVATARS.rowan,
    emergencyContacts: [
      { naam: "Carla Horn", telefoon: "+31 6 26 23 68 95" },
    ],
  },
  {
    id: "roemer",
    naam: "Roemer",
    bio: "Roemer begon zijn carrière als foet buschauffeur, deels vanwege zijn stekelige kapsel dat elke kamweerstand tartte. Inmiddels is hij goed opgedroogd en heeft hij zijn reputatie als grootneuker volledig waargemaakt. In de wandelgangen bekend als ‘De Wurger’ — een bijnaam die hij stiekem liever kwijt is — maar worstelen doet hij niet… of misschien toch, het hangt er maar net vanaf wie je het vraagt. Gewapend met droogshampoo arriveerde hij ooit in Val Thorens voor de skireis van het corps; of die inspanning daadwerkelijk vruchten heeft afgeworpen, Joost mag het weten. Dus laten we die amice even door de telefoon heen trekken.",
    avatar: AVATARS.roemer,
    emergencyContacts: [
      { naam: "Kaj Wage", telefoon: "+31 6 28651015" },
      { naam: "Claudia Wage", telefoon: "+31 6 19440837" },
    ],
  },
  {
    id: "daan",
    naam: "Daan",
    bio: "Daan is de betweterige Brabander die denkt dat een diploma Business, Science & Innovation automatisch gelijkstaat aan genialiteit. Hij ziet er onmiskenbaar beter uit dan Roemer, maar weet op het gebied van wijven opvallend weinig indruk te maken. Kanker overleefd, marathon na marathon en zelfs Ironmans alsof elke dag zijn laatste kan zijn — Daan leeft op uitersten en adrenaline. Overdag werkt hij bij BAM in de bouw, maar hoe, wat of waarom? Niemand die het weet. Een man van discipline, doorzettingsvermogen en een tikje arrogantie, die zijn indrukwekkende prestaties graag tentoonstelt, zelfs als de context soms ontbreekt. Daan: gezond, gespierd en altijd onderweg, maar net iets mysterieus onbegrepen.",
    avatar: AVATARS.daan,
    emergencyContacts: [
      { naam: "Ed van Rhijn", telefoon: "+31 6 11321975" },
    ],
  },
  {
    id: "xander",
    naam: "Xander",
    bio: "Xander, Frustappel, Hodor,  Kssssssander, Haanbanaan, high definition display?!? Hij is een frust in hart en nieren. Bij de gedachte aan een groen vest manifesteert deze wraakvaars het Pavlov effect. Zijn signature move is de tongtornado, waarbij hij lam zijn tong uitsteekt op de dansvloer. Bovendien denkt Kkksssander dat zijn vermeende intelligentie compenseert voor zijn werkelijke aardappelhoofd. (Tuurlijk niet). Zijn bankrekening dan weer wel. Well played Eline ;-).",
    avatar: AVATARS.xander,
    emergencyContacts: [
      { naam: "Nicoline Franken", telefoon: "+31 6 28887623" },
    ],
  },
  {
    id: "derek",
    naam: "Derk",
    bio: "Na zijn \"corpsière\" belandde Derk in een klassieke quarterlifecrisis. PPLE leerde hem vooral dat vier studies tegelijk volgen betekent dat je geen van allen serieus neemt. Vier perspectieven, nul expertise. Dus, hij liet zich omscholen met een MSc BA, vastberaden om de corporate ladder te beklimmen. Maar toen die ladder eenmaal binnen handbereik was, besloot hij toch eerst iets te doen “wat hij écht leuk vond”: een interne stage bij De Speld. Al snel bleek alleen dat idealisme geen huur betaalt. Jort Kelder evenmin. Romantiek is helaas geen verdienmodel. En zo klopt Derk nu toch maar aan bij de Big Four, klaar om het eerste treetje te bestijgen dat eigenlijk altijd al onvermijdbaar was. Omdat die uitnodiging nog op zich laat wachten, hebben wij hem vast aan werk geholpen: het schrijven van deze tekstjes. In de liefde gaat het al net zo wispelturig: waar hij op jaarweekend nog zeker wist dat zijn toekomstige vrouw Emma, Sophie of Julia zou heten, heeft hij nu Danka in zijn tukkerige witte armpjes gesloten. Ontwikkeling noemen we dat. O ja — lekker wief trouwens!",
    avatar: AVATARS.derk,
    emergencyContacts: [
      { naam: "Rutger Stroeve", telefoon: "+31 6 12 07 52 23" },
    ],
  },
  {
    id: "dost",
    naam: "Julius",
    bio: "Dost is de man van de relaties. Zijn liefdescarrière begon met de ordinaire corpstijger Emma Arakelian, maakte een tussenstopje bij knor Eline, vervolgde met Julia van Pharos, en eindigde tot ieders genoegen bij Pinote Valerie. Als mede oprichter van Aurea Trianguli en fervent cuba libre aanhanger neemt hij een illustere positie in binnen Beaufort. Gewapend met Baco in de hand en Peppas op de box bereikte hij onvoorstelbare hoogtes. Niettemin met een toekomstige erfenis van 300 miljoen heeft ome Dost alle schaapjes keurig op het droge. Voor het huishouden hoeft hij bij Valerie niet aan te kloppen; daar betaalt zij liever iemand voor. Gelijk heeft ze!",
    avatar: AVATARS.dost,
    emergencyContacts: [
      { naam: "Ingrid Dost", telefoon: "+31 6 53 12 45 57" },
      { naam: "Arjan Dost", telefoon: "+31 6 43 37 97 80" },
      { naam: "Valerie Snel", telefoon: "+31 6 41 79 31 75" },
    ],
  },
  {
    id: "tijs",
    naam: "Tijs",
    bio: "Tijs is de belichaming van Wassenaarse welvaart met een Rijnlands Lyceum-stempel: keurig gekweekt, strak opgegroeid en licht wereldvreemd. Een mooie kakker, boom van een vent, die bij binnenkomst meer ruimte inneemt dan zijn inhoud. Ooit had hij een fleur bij Thalia, maar die waren hem toch net iets te extreem — principieel, uiteraard. Kleurenblind, maar opvallend selectief in wat hij wél ziet. Werkt tegenwoordig in corporate recruitment, waar hij met vaste hand cv’s schuift en kansen belooft. Altijd ziek, zwak en misselijk, een medisch mysterie met agenda. De drakentemmers van Beaufort staan in de schaduw van deze pilsridder die namelijk de double dragon heeft weten vast te leggen, iconisch beeldmateriaal voor het nageslacht.",
    avatar: AVATARS.tijs,
    emergencyContacts: [
      { naam: "Jolien Wiesenhaan", telefoon: "+31 6 15386521" },
      { naam: "Frank Roos", telefoon: "+31 6 53537373" },
    ],
  },
  {
    id: "felix",
    naam: "Felix",
    bio: "Felix is het levende bewijs dat haaruitval geen carrièrebeperking is. Met een glimmend hoofd en een fonkelnieuwe vriendin paradeert hij zelfverzekerd door het leven alsof hij het zelf heeft uitgevonden. Overdag doet hij alsof hij werkt bij Coolblue als inhouse consultant, ’s avonds doet hij alsof hij niet alweer bij de borrel staat. Zijn échte talent? Regelmatig op audiëntie bij CEO Pieter, waar hij met veel knikken en weinig inhoud strategische grootspraak uitwisselt. Altijd aanwezig, zelden noodzakelijk, maar vreemd genoeg onmisbaar. Een man van weinig haar, veel praat en een agenda die verdacht vaak “overleg” vermeldt. Kortom: een klassieke jaargenoot waar je niet omheen kunt, al probeer je het soms wel.",
    avatar: AVATARS.felix,
    emergencyContacts: [
      { naam: "Peter Donker van Heel", telefoon: "+31 6 26508620" },
      { naam: "Dorothee Posthumus Meyes", telefoon: "+31 6 52070686" },
      { naam: "Britt Hagens", telefoon: "+31 6 33989391" },
    ],
  },
  {
    id: "olivier",
    naam: "Olivier",
    bio: "Olivier is wat eruit komt wanneer twee knorren een corpsbal verwekken. Samen met zijn broers in de categorie modderbloedjes bezoedelen zij de bloedlijnen van de corporale elite. Laat het Malfidus niet horen en Vo voor Zwadderich! Dat bakje zoetzuur op je neus was je verdiende loon. Olivier begon zijn corpsière als KC’er, streed zich door PR-management door een school in Afrika te bouwen via Stichting Moet, en eindigde uiteindelijk als ab actis van Beaufort. Volgens Rick uit jaar ’16 (hoe heet die gek ook alweer?) blijft Olivier gewoon een knor, en wij sluiten ons daar met volle overtuiging bij aan, knorresteijn",
    avatar: AVATARS.olivier,
    emergencyContacts: [
      { naam: "Maarten Grasveld", telefoon: "+31 6 53611356" },
      { naam: "Monica Grasveld", telefoon: "+31 6 23365871" },
      { naam: "Charlotte Stikkelbroeck", telefoon: "+31 6 55730183" },
    ],
  },
];
