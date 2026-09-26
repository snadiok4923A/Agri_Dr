/**
 * authBackgrounds.js — image list for the auth-page background slideshow.
 *
 * Files live in `public/logpic/` and are served as static assets
 * (BASE_URL-safe URLs are built in AuthLayout.jsx). Browser code cannot
 * list a directory, so the rotation reads THIS list — drop a new image
 * into public/logpic/ and add its filename below; it joins the loop
 * automatically.
 *
 *   pc*.jpg → desktop/tablet rotation (768px and up)
 *   mob*.jpg → mobile rotation (below 768px)
 *
 * The FIRST entry of each list is the initial image — keep pc.jpg /
 * mob.jpg first (spec: no random first image).
 */

export const PC_BACKGROUNDS = [
    "pc.jpg",
    "pc1.jpg",
    "pc2.jpg",
    "pc3.jpg",
    // "pc4.jpg", ← add here when the file exists in public/logpic/
];

export const MOB_BACKGROUNDS = [
    "mob.jpg",
    "mob1.jpg",
    "mob2.jpg",
    "mob3.jpg",
    // "mob4.jpg", ← add here when the file exists in public/logpic/
];
