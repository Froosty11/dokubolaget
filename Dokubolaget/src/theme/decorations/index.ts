// Registers every theme's decorations. Imported once by ThemeBackdrop.tsx.
import { CyberwaveBackdrop } from "./CyberwaveBackdrop";
import { Maypole } from "./Maypole";
import { MidsommarMeadow } from "./MidsommarMeadow";
import { PaperGrain } from "./PaperGrain";
import { SpeakeasyFan } from "./SpeakeasyFan";
import { BACKDROPS, CELEBRATION_ART } from "./registry";

BACKDROPS.prislista = PaperGrain;
BACKDROPS.midsommar = MidsommarMeadow;
BACKDROPS.cyberwave = CyberwaveBackdrop;
BACKDROPS.speakeasy = SpeakeasyFan;
CELEBRATION_ART.midsommar = Maypole;
