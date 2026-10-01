// Registers every theme's decorations. Imported once by ThemeBackdrop.tsx.
import { CyberwaveBackdrop } from "./CyberwaveBackdrop";
import { Maypole } from "./Maypole";
import { MidsommarMeadow } from "./MidsommarMeadow";
import { PaperGrain } from "./PaperGrain";
import { SpeakeasyFan } from "./SpeakeasyFan";
import { BACKDROPS, CELEBRATION_ART, DECORATIONS } from "./registry";
import { Arcade } from "./kit/Arcade";
import { Candlelight } from "./kit/Candlelight";
import { Cellar } from "./kit/Cellar";
import { Circuit } from "./kit/Circuit";
import { ColorBars } from "./kit/ColorBars";
import { Dancefloor } from "./kit/Dancefloor";

BACKDROPS.prislista = PaperGrain;
BACKDROPS.midsommar = MidsommarMeadow;
BACKDROPS.cyberwave = CyberwaveBackdrop;
BACKDROPS.speakeasy = SpeakeasyFan;
CELEBRATION_ART.midsommar = Maypole;

DECORATIONS.dancefloor = Dancefloor;
DECORATIONS.arcade = Arcade;
DECORATIONS.colorbars = ColorBars;
DECORATIONS.circuit = Circuit;
DECORATIONS.candlelight = Candlelight;
DECORATIONS.cellar = Cellar;
