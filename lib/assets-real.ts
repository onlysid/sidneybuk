// Paths to files in /public, and addresses of pictures that live on a project's own site.
export const assets = {
  logo: "/logo.svg",
  logoWhite: "/logo-white.svg",
  // Pictures for portfolio pieces, used by key in lib/portfolio.ts.
  work: {
    // Passage 2 Pro: the pitch photograph and crest from the site's own repository.
    p2pPitch: "/work/p2p-pitch.jpg",
    p2pLogo: "/work/p2p-logo.png",
    // WheelTune: screenshots of the site and the web dashboard.
    wheeltuneSite: "/work/wheeltune-site.jpg",
    wheeltuneDashboard: "/work/wheeltune-dashboard.jpg",
    wheeltuneHow: "/work/wheeltune-how.jpg",
    // WheelTune's App Store screenshots, served by Apple (the trailing size can be changed).
    wheeltunePhone1: "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/22/7b/d4/227bd48b-77c2-59f0-6eda-538ee44a55f6/Simulator_Screenshot_-_iPhone_17_Pro_Max_-_2026-06-01_at_10.45.43.png/600x1300bb.jpg",
    wheeltunePhone2: "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/99/54/61/99546181-1e73-ced5-8acd-9c8f2dd54357/Simulator_Screenshot_-_iPhone_17_Pro_Max_-_2026-06-01_at_10.46.05.png/600x1300bb.jpg",
    wheeltunePhone3: "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/76/eb/b7/76ebb734-0743-f8d9-f99b-0edb66c2d665/Simulator_Screenshot_-_iPhone_17_Pro_Max_-_2026-06-01_at_10.46.12.png/600x1300bb.jpg",
    wheeltunePhone4: "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/be/e5/d6/bee5d68b-c74e-1ac6-7c89-3a466e993e1c/Simulator_Screenshot_-_iPhone_17_Pro_Max_-_2026-06-01_at_10.46.22.png/600x1300bb.jpg",
    wheeltunePhone5: "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/d5/96/bf/d596bf57-2c69-427f-32b3-4e33c5a5e8a2/Simulator_Screenshot_-_iPhone_17_Pro_Max_-_2026-06-01_at_10.45.35.png/600x1300bb.jpg",
    wheeltunePhone6: "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/4d/f8/42/4df842bd-988a-4ac8-6861-af74927786c0/Simulator_Screenshot_-_iPhone_17_Pro_Max_-_2026-06-01_at_10.46.31.png/600x1300bb.jpg",
    wheeltunePhone7: "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/a0/4f/8a/a04f8a87-51e9-55d5-f8d0-26c62b8ca967/Simulator_Screenshot_-_iPhone_17_Pro_Max_-_2026-06-01_at_10.45.59.png/600x1300bb.jpg",
    wheeltunePad1: "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/6b/14/fc/6b14fc24-e92a-318c-0997-173ea60f65fe/Simulator_Screenshot_-_iPad_Pro_13-inch__U0028M5_U0029_-_2026-06-01_at_10.40.23.png/900x1200bb.jpg",
    wheeltunePad2: "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/3b/1a/8e/3b1a8e78-d928-168d-9fa6-4c051e7f8c5a/Simulator_Screenshot_-_iPad_Pro_13-inch__U0028M5_U0029_-_2026-06-01_at_10.40.51.png/900x1200bb.jpg",
    wheeltuneIcon: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/7f/a6/3e/7fa63e58-2057-592e-b3c6-9de99fb54961/AppIcon-0-0-1x_U007emarketing-0-11-0-85-220.png/512x512bb.jpg",
  } as Record<string, string>,
  // Audio and downloads for the music pages, used by key in lib/doses.ts and lib/repertoire.ts.
  media: {
    sampleDose1: "/music/sample-dose-1.wav",
    sampleDose2: "/music/sample-dose-2.wav",
    sampleLyrics1: "/music/sample-lyrics-1.txt",
  } as Record<string, string>,
};
