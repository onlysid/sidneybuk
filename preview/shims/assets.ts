// @ts-nocheck: these imports are embedded as base64 by the preview bundler.
import logo from "../../public/logo.svg";
import logoWhite from "../../public/logo-white.svg";
import p2pPitch from "../../public/work/p2p-pitch.jpg";
import p2pLogo from "../../public/work/p2p-logo.png";
import wtSite from "../../public/work/wheeltune-site.jpg";
import wtDash from "../../public/work/wheeltune-dashboard.jpg";
import wtHow from "../../public/work/wheeltune-how.jpg";
import dose1 from "../../public/music/sample-dose-1.wav";
import dose2 from "../../public/music/sample-dose-2.wav";
import lyrics1 from "../../public/music/sample-lyrics-1.txt";
import { assets as real } from "../../lib/assets-real";

const url = (b64: string) => `data:image/svg+xml;base64,${b64}`;
// Local pictures are embedded; ones that live on another site keep their address.
export const assets = { logo: url(logo), logoWhite: url(logoWhite), work: { ...real.work, p2pPitch: `data:image/jpeg;base64,${p2pPitch}`, p2pLogo: `data:image/png;base64,${p2pLogo}`, wheeltuneSite: `data:image/jpeg;base64,${wtSite}`, wheeltuneDashboard: `data:image/jpeg;base64,${wtDash}`, wheeltuneHow: `data:image/jpeg;base64,${wtHow}` }, media: { sampleDose1: `data:audio/wav;base64,${dose1}`, sampleDose2: `data:audio/wav;base64,${dose2}`, sampleLyrics1: `data:text/plain;base64,${lyrics1}` } };
