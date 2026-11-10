# Refonte de l'interface : vue 3D plein écran

## Problem statement

Sur ordinateur, la vue 3D n'occupe qu'environ 40 % de l'écran. Le reste est pris par :

- une grille de formulaires bruts : 13 cases « par nature », 12 cases et 12 boutons « par système », un curseur de dissection et trois coupes ;
- un arbre en colonne fixe ;
- un panneau Info rempli de données de développeur (slug, statut « brouillon », couche, trois badges « non relu ») ;
- un pied de page de crédits.

Les commandes du mouvement, la fonction la plus parlante, sont sous la ligne de flottaison du panneau Info.

Le survol n'est signalé que par un texte dans la barre d'état, loin du curseur. On ne peut pas cacher une structure gênante ni regarder une structure seule. La caméra n'a ni vues prédéfinies ni recentrage. Sur téléphone, l'en-tête prend trois lignes et les panneaux sont figés sous la vue.

## Solution

**Ordinateur**

- **Vue 3D sur toute la fenêtre.** Tout le reste flotte par-dessus dans des panneaux translucides sombres.
- **En-tête fin** : bouton « Structures », titre, recherche au centre, choix Homme/Femme, langue des noms, menu ⋯ (Hors ligne, Données et licences, Aide).
- **Tiroir de gauche** : l'arbre des structures. Ouvert par défaut sur les grands écrans, il se ferme d'un clic.
- **Carte Infos à droite**, présente seulement quand une structure est sélectionnée :
  - nom, côté, nature et systèmes ;
  - quatre actions : Centrer, Isoler, Masquer, Animer ;
  - les trois noms, avec une seule mention quand des traductions ne sont pas relues ;
  - les mouvements et les muscles ;
  - un repli « Détails techniques ».
- **Barre d'outils en bas** : Calques, Dissection, Coupes, Mouvement. Chaque outil ouvre un panneau au-dessus de la barre, un seul à la fois. Le panneau Mouvement porte le choix de l'articulation, la lecture, le repos et le curseur d'angle.
- **Survol** : une étiquette près du curseur nomme la structure, qui s'éclaircit.
- **Caméra** : boutons Face, Dos, Gauche, Droite, Dessus et Recentrer. Un double-clic sélectionne une structure et cadre dessus. Les déplacements sont animés.
- **Crédits** : une ligne courte en bas à gauche, avec un lien vers « Données et licences ».

**Téléphone**

- En-tête sur une ligne : titre, loupe, menu ⋯ (qui porte aussi le modèle et la langue).
- Vues caméra en colonne en haut à droite.
- Tiroir du bas à trois hauteurs (replié, moitié, plein), avec les onglets Infos, Arbre, Outils.

**Partout**

- Un thème sombre unique.
- Des icônes avec libellé visible.
- Des cibles de 44 px.

La maquette validée est le canevas « Atlas UI refonte » (claude.ai, privé).

## User stories

1. As an étudiant, I want the 3D view to fill the window, so that I see the body large and the anatomy is the focus.
2. As an étudiant, I want the tree in a drawer I can close, so that I get the whole width when I don't need it.
3. As an étudiant, I want the drawer open by default on a wide screen and my choice remembered, so that I don't reopen it on every visit.
4. As an étudiant, I want the search always visible in the header, so that I can find a structure at any moment.
5. As an étudiant, I want to switch between the male and female models with two buttons, so that the choice is one click and I see which model is shown.
6. As an étudiant, I want Hors ligne, Données et licences and Aide in a ⋯ menu, so that the header stays uncluttered.
7. As an étudiant, I want an Aide dialog listing the mouse, touch and keyboard gestures, so that I discover what the viewer can do.
8. As an étudiant, I want the information card to appear only when something is selected and to close with one button, so that it never hides the body for nothing.
9. As an étudiant, I want the card to lead with the name, the side, the nature and the systems, so that I learn the essentials first.
10. As an étudiant, I want the French, English and Latin names with a single note when some are not reviewed, so that I trust the names without three warning badges.
11. As a curator, I want the slug, the layer and the status still reachable in a "Détails techniques" fold, so that I can check data without them cluttering the card.
12. As an étudiant, I want a Centrer action, so that the camera frames the selected structure.
13. As an étudiant, I want an Isoler action that turns everything else transparent, so that I see the structure alone in its context.
14. As an étudiant, I want a banner while a structure is isolated, with a "Quitter l'isolement" button, so that I always know why the rest is transparent and how to get it back.
15. As an étudiant, I want a Masquer action that removes the selected structure, so that I can clear what is in the way.
16. As an étudiant, I want a banner counting the hidden structures, with "Réafficher", and Ctrl+Z (⌘Z) to bring back the last one, so that hiding is never a trap.
17. As an étudiant, I want an Animer action on a structure that takes part in a movement, so that one click shows its joint moving.
18. As an étudiant, I want a tool bar at the bottom with Calques, Dissection, Coupes and Mouvement, each with an icon and a visible label, so that every tool is one click away and recognisable.
19. As an étudiant, I want only one tool panel open at a time, closed by a second click or Échap, so that panels never pile up.
20. As an étudiant, I want to keep turning the body while a tool panel is open, so that I can adjust a cut and look at it at once.
21. As an étudiant, I want a mark on a tool's button when its settings differ from the default (a hidden system, a removed layer, a cut, a joint out of rest), so that I know why the body looks different.
22. As an étudiant, I want the Calques panel to list the systems with an on/off switch, a "Solo" button and "Tout afficher", so that I can combine systems or study one.
23. As an étudiant, I want the tissue filter folded under "Par nature de tissu" with its colour swatches, so that the colours of the 3D view stay explained without crowding the panel.
24. As an étudiant, I want the Mouvement panel to choose any joint of the model and side, play, pause, return to rest and set the angle, so that I can drive a movement without selecting a bone first.
25. As an étudiant, I want the muscles acting on the joint to stay listed in the information card, so that I read them while the joint moves.
26. As an étudiant using a mouse, I want a label next to the cursor naming the structure under it, and that structure lightened, so that I can identify things before clicking.
27. As an étudiant, I want no hover label while I drag to turn the body, so that it does not flicker.
28. As an étudiant, I want Face, Dos, Gauche, Droite and Dessus buttons, so that I reach the standard anatomical views in one click.
29. As an étudiant, I want a Recentrer button, so that I get the whole body back after zooming in.
30. As an étudiant, I want to double-click a structure to select it and frame it, so that I zoom on it in one gesture.
31. As an étudiant, I want camera moves to glide, and to be instant when I asked my system for reduced motion, so that I keep my bearings without discomfort.
32. As an étudiant, I want any camera glide to stop as soon as I drag, so that I stay in control.
33. As an étudiant, I want the loading progress and errors shown as notifications over the view, so that I see them without a status bar.
34. As a data provider, I want a permanent short credit line over the view with a link to the full licences, so that attribution is visible as the licences require.
35. As an étudiant on a phone, I want a one-line header with a search button and a ⋯ menu holding the model and the language, so that the 3D view gets the screen.
36. As an étudiant on a phone, I want a bottom sheet I can drag or tap to three heights, so that I choose how much room the panels take.
37. As an étudiant on a phone, I want the sheet to rise to half height on the Infos tab when I tap a structure, so that I read about it at once.
38. As an étudiant on a phone, I want the tools in an Outils tab with the same four tools, so that everything available on a computer is available on my phone.
39. As an étudiant using a keyboard or a screen reader, I want every control to be a native button, switch, slider or menu with an explicit name, and focus to return where it was when a panel or menu closes, so that I can use the whole interface without a mouse.
40. As an étudiant, I want isolation and hidden structures kept in the shared URL, so that a link shows the same view.
41. As an étudiant, I want the interface to stay smooth with panels open, so that the redesign costs nothing in fluidity.

## Implementation decisions

### Layout

- **One stage, overlays on top.** The canvas fills the window, on desktop and phone. Every other piece is positioned over it:
  - header, drawer, card, tool bar, tool panel, camera group, banners, notifications and credit line.
  - The CSS grid of the current layout goes.
  - The canvas keeps its size when panels open or close; the camera does not move.
- **Breakpoints.**
  - Narrow (phone layout) below 900 px, as today, through the existing narrow hook.
  - The drawer's default state switches at 1200 px.
- **Drawer.**
  - Open by default at 1200 px and wider, closed below.
  - The "Structures" header button toggles it (`aria-expanded`, `aria-controls`).
  - The last choice is stored in `localStorage` (key `haac.drawer`). Every read and write sits in try/catch, and the default applies when storage is unavailable.
  - Left, from below the header to above the tool bar, 300 px wide.
  - On a phone the drawer does not exist: the tree is the Arbre tab.
- **Card.**
  - Right, below the header, 360 px wide.
  - Scrolls inside itself, never taller than the space above the camera group.
  - Present only while there is a selection.
  - Its close button clears the selection.
- **Tool bar.** Centred at the bottom. Four buttons, each with an icon and a visible label:
  - Calques, Dissection, Coupes, Mouvement;
  - `aria-pressed` while its panel is open, `aria-controls` the panel.
- **Tool panel.**
  - Centred above the tool bar; widths 560 (Calques), 420 (Dissection, Coupes) and 640 (Mouvement) px.
  - Non-modal: the canvas stays interactive.
  - One open at a time: opening one closes the other; a second click on its button closes it.
  - Focus stays on the button when the panel opens. Échap closes it and returns focus to its button.
  - Échap closes one thing at a time, the topmost first: an open dialog (native), then the ⋯ menu, then the search results (as today), then the tool panel. It never clears the selection.
  - Which tool is open is UI state, not view state: not in the URL.
- **Change marks.** A dot on a tool button when its part of the view differs from the default:
  - Calques: `hiddenSystems` or `hiddenKinds` not empty;
  - Dissection: `layerCut` > 0 or `ghost`;
  - Coupes: a section on;
  - Mouvement: a pose not empty.

  The mark has a text alternative in the button's accessible name ("Calques, modifié").
- **Camera group.** Bottom right on desktop, a row: Face, Dos, Gauche, Droite, Dessus, and Recentrer as an icon button with an accessible name. On a phone, a column top right: Face, Dos, Profil (= Gauche), Recentrer.
- **Credit line.**
  - Bottom left, one line: "Données : " followed by the attribution names, then a "Licences" link that opens the existing credits dialog.
  - The line is ellipsised visually; the full text stays in the DOM.
  - On a phone it sits above the sheet when the sheet is at its folded height. It is hidden at the other heights: the credits stay reachable from the ⋯ menu.
- **Notifications.**
  - Top centre, below the header:
    - loading progress ("Chargement des modèles a / b…") while loading;
    - errors and failed kinds as `role="alert"`, persistent until closed.
  - The rendering backend (WebGPU / WebGL2) moves to the Aide dialog.
  - The status bar goes.
- **Banners.** Top centre, below the notifications: "Isolement : <nom> · Quitter l'isolement", and "<n> structure(s) masquée(s) · Réafficher".
- **Female notice.** Its content does not change; it becomes a dismissible banner under the header, in the same place as the other banners.
- **Update banner** unchanged.

### Header

- **Desktop**, in order:
  1. "Structures" toggle;
  2. title;
  3. search, centred, max 520 px;
  4. model group "Modèle": two buttons Homme / Femme with `aria-pressed`, disabled while switching;
  5. "Noms" select (FR / EN / LA);
  6. the offline tag, as today;
  7. the ⋯ menu button.
- **⋯ menu.**
  - It follows the menu-button pattern:
    - arrow keys move between items;
    - Échap closes it and returns focus to the button;
    - a click outside closes it.
  - Items: "Hors ligne…", "Données et licences…", "Aide et raccourcis".
  - On a phone the menu also holds Modèle (two radio items) and Noms (three radio items).
- **Aide dialog** (new, native `<dialog>` like the others). It lists:
  - mouse gestures: drag, wheel, click, double-click;
  - touch gestures: drag, pinch, tap, double tap;
  - keyboard shortcuts: Échap, Ctrl/⌘ + Z, Page Up / Page Down on the angle slider, and the tree keys;
  - the rendering backend.
- **Phone header.** Title, a search button, the ⋯ button. The search button replaces the header content with the search field and a close button; closing returns focus to the search button.

### Information card

The InfoPanel becomes the card. From top to bottom:

1. **Name** (selected language) as the heading.
2. **Subtitle**: "Côté <côté> · <nature> · <parent link>". The side is omitted for a midline structure.
3. **System chips**, one per system.
4. **Actions** — a row of four buttons, each with an icon and a label:
   - Centrer: `focus(slug, side)`;
   - Isoler: toggle, `aria-pressed`;
   - Masquer;
   - Animer: present only when the structure takes part in a joint (the joints `jointsFor` returns for it, or its `actions`).
5. **Names**: a definition list FR / EN / LA, each with its `lang`. If at least one label is `draft`, a single note below: "Traductions importées, pas encore relues."
6. **Movement section**: what MotionPanel lists today, without the slider, the play buttons and the joint choice, which move to the Mouvement tool. It shows:
   - for a bone: its joints and the muscles acting on the current joint;
   - for a muscle: its actions (joint, role).
7. **Parts** (children links), as today.
8. **Fold** "Détails techniques" (`<details>`): Slug, Couche, Statut.

### Isolation and hidden structures (view state)

- **`ViewState.isolated: Selection | null`**, default `null`.
  - The instances of that structure-side (through `instancesOf`, so a group isolates its descendants) are shown opaque, whatever the other filters.
  - Every other visible instance is ghosted at `GHOST_ALPHA`, so it is not pickable.
  - The selection may change during isolation; isolation stays until it is left.
- **`ViewState.hidden: string[]`**, keys `slug` or `slug@side`, in the order they were hidden, default empty.
  - The instances of each key are hidden.
  - Masquer appends the selection's key and clears the selection.
  - Ctrl+Z / ⌘Z removes the last key, unless focus is in a text field.
  - "Réafficher" empties the list.
  - Hiding a structure that is isolated leaves isolation.
- **`appearance`** gains three instance sets: `hidden`, `isolated`, `hovered`. Its result gains `hovered: boolean`. The order of the rules:
  1. out of model → invisible;
  2. selected → visible, highlighted;
  3. hidden → invisible;
  4. isolated → visible, opaque;
  5. hidden kind / hidden systems / removed layer → as today;
  6. isolation active and not isolated → alpha at most `GHOST_ALPHA`;
  7. crossing a moving joint → alpha at most `GHOST_ALPHA`;
  8. hovered: `true` only for a visible, opaque, unhighlighted instance.
- **The catalog** resolves keys to instance sets. A key whose structure is unknown in the model is dropped.
- **`view-hash`.**
  - `iso=slug` or `iso=slug@side`.
  - `hid=` with the keys comma-separated, in their hiding order: order matters for undo.
  - Unknown structures are dropped when the hash is applied. Existing URLs stay valid.

### Hover

- **When.** Only when the device has a fine pointer that hovers (`(hover: hover) and (pointer: fine)`). Never while a button is down (already the case), and never on a ghosted instance.
- **Tint.** The hovered structure-side is tinted: its kind colour mixed 35 % towards white. The tint goes through the same per-instance colour path as the selection highlight, which keeps its `#3ad06a`.
- **Label.**
  - Text: the structure name in the selected language, plus the side.
  - Placed 14 px right of and 14 px below the cursor, flipped to the left or above when it would overflow the window. The placement is a pure function.
  - `pointer-events: none` and `aria-hidden` (the selection is what is announced).
  - It disappears when the pointer leaves the canvas.

### Camera

- **Presets.**
  - Face, Dos, Gauche, Droite and Dessus put the camera on the anterior, posterior, left lateral, right lateral and superior side of the body, in the BodyParts3D frame.
  - They keep the current target and the current distance, so a zoom on the elbow stays on the elbow.
  - Up stays the body's superior axis, except for Dessus: there, up is the anterior axis, so the face points to the top of the screen.
- **Recentrer** returns to the default framing: the whole body, from the front.
- **Double-click / double tap** on a pickable structure selects it and focuses it. On empty space it does nothing.
- **Transitions.**
  - `focus`, presets and Recentrer interpolate the target and the position over 400 ms, ease-in-out (cubic).
  - With `prefers-reduced-motion: reduce` they are instant. Restoring a camera from the URL is always instant.
  - Starting a drag, wheel or pinch cancels a running transition where it stands.
  - The interpolation is a pure function of the start, the end and the elapsed time.

### Calques panel

- **"Systèmes" list**, two columns on desktop, one on a phone. Per system present in the model:
  - a switch: a native checkbox styled as a switch, named by the system name, as today;
  - the name;
  - a "Solo" button named "Solo : <système>", which is today's isolate (hides the other systems).
- **"Tout afficher"** in the panel heading, disabled when nothing is hidden.
- **Fold "Par nature de tissu"** (`<details>`, closed by default): today's kind checkboxes with their swatches, in three columns.
- **No colour per system.** The 3D colours depend on the kind, and a system colour would contradict them.

### Dissection and Coupes panels

The current controls, restyled:

- Dissection: the layer slider, with its value text, and the ghost switch.
- Coupes: three rows of switch + position slider.

### Mouvement panel and Animer

- **The panel.**
  - A joint select listing every joint of the model and side: "Coude gauche", "Coude droit", "Avant-bras gauche", …
  - The play / pause button.
  - "Repos".
  - The angle slider with its functional arc and its value ("90° de flexion").

  These are today's controls from MotionPanel, moved.
- **The preselected joint:**
  - the selection's joint when the selection takes part in one;
  - else the last one used in the session;
  - else the first.
- **Animer** opens the Mouvement panel on the selection's joint and side, and starts the playback (loop, as play does; one sweep under reduced motion, as today).

### Phone

- **Sheet heights:**
  - folded: 96 px — the handle, plus the selected name and an Animer button, or "Touchez une structure" when nothing is selected;
  - half: 50 % of the window height;
  - full: the window height minus the 56 px header.
- **Changing height.**
  - The handle is a button: a tap cycles folded → half → full → folded, and its accessible name says what the next tap does.
  - Dragging the handle moves the sheet, which snaps to the nearest height on release. The snap is a pure function.
- **Tapping a structure** raises the sheet to at least half, on the Infos tab.
- **Tabs** Infos / Arbre / Outils, keyboard behaviour as today. Outils holds a segmented control of the four tools (one always selected, Calques first) above the selected tool's controls.

### Theme and icons

- **Dark only.** `color-scheme: dark`, with the tokens on `:root`:
  - colours:
    - `--stage` `#1d2026`;
    - `--surface` `rgb(22 25 31 / 88%)` with `backdrop-filter: blur(12px)`;
    - `--line` `rgb(255 255 255 / 9%)`;
    - `--text` `#e8eaed`;
    - `--muted` `#a3a9b3`;
  - accents and states:
    - `--accent` `#8cc4ff` (links, focus);
    - `--active` `#2b4a6e` (pressed tool, selected row, chosen model);
    - `--switch-on` `#3d8ae0`;
  - notes:
    - `--warn-bg` `rgb(240 180 80 / 12%)`, `--warn-fg` `#f3cf8e`;
    - `--role-bg` `rgb(120 200 140 / 15%)`, `--role-fg` `#b6e8c2`.
- **Shapes and type.**
  - Panels: radius 14 px. Buttons: radius 10 px.
  - Focus ring: 3 px `--accent`, offset 2 px.
  - Type: the system font stack. No web font, which would be a request outside the origin.
- **Icons.** `lucide-react`, imported one by one. Each icon is `aria-hidden`; the button's name comes from its visible label, or from `aria-label` when it shows only an icon.

### Strings

French, in `strings.ts`. They include:

- new labels: Structures, Calques, Dissection, Coupes, Mouvement, Centrer, Isoler, Masquer, Animer, Solo, Quitter l'isolement, Réafficher, Détails techniques, Par nature de tissu, Aide et raccourcis, Face, Dos, Gauche, Droite, Dessus, Profil, Recentrer, Touchez une structure;
- the handle names;
- the banner texts.

### Vocabulary (CONTEXT.md)

- **Isolement**: one structure opaque, the rest ghosted.
- **Solo**: one system shown, the other systems hidden.
- **Structure masquée**: a structure removed from the view by the user.

## Testing decisions

- **Seam 1: app pure modules (node:test):**
  - `appearance` with `hidden`, `isolated` and `hovered`:
    - the eight-rule order;
    - an isolated instance shown despite a hidden kind;
    - the selection still above everything;
    - hovered never on a ghost;
  - catalog: keys resolved to instance sets, unknown keys dropped;
  - `view-hash`: `iso=` and `hid=` round trip, `hid=` order kept, unknown values dropped, old URLs unchanged;
  - camera: the preset position from target, distance and preset; the transition interpolation (ends, midpoint, monotony);
  - the hover-label placement (flip at each edge);
  - the sheet snap (nearest height, edges).

  Prior art: `catalog-appearance.test.ts`, `view-hash.test.ts`, `pose.test.ts`.
- **Seam 2: e2e (Playwright, existing projects webgpu / webgl / mobile)**, specs rewritten for the new structure:
  - **Layout.** The canvas covers the whole window.
  - **Drawer.** It toggles and its state survives a reload.
  - **Tools.** One panel at a time; Échap closes it and focus returns.
  - **Change marks.** The mark appears when a system is hidden.
  - **Card:**
    - it appears on selection and its close button clears it;
    - Isoler ghosts a bone (alpha read through `instanceState`), shows the banner and survives a reload through the URL;
    - Masquer hides it, the banner counts, Ctrl+Z brings it back;
    - Animer opens Mouvement and moves the joint.
  - **Camera.**
    - Dos puts the camera behind the body (camera state from `getState`).
    - Recentrer gives the default view back.
    - Double-click selects and frames.
  - **Hover.** The label appears near the cursor over a structure and not during a drag.
  - **Mobile:**
    - one-line header;
    - the ⋯ menu changes the model;
    - the handle cycles the three heights;
    - a tap opens Infos at half height;
    - Outils holds the four tools.
  - **Existing behaviour carried over:** search, systems filter, sections, motion, offline, female model and credits dialog.
- **Seam 3: performance.** The smoke-test budget is unchanged and measured with the drawer and a tool panel open.

## Global constraints

- New runtime dependency, pinned exactly: `lucide-react@1.66.0` (ISC). No other new dependency.
- Dark theme only, tokens and values as in "Theme and icons"; system font stack, no web font.
- Breakpoints: phone layout below 900 px; drawer open by default from 1200 px.
- Every interactive target at least 44 × 44 px, including the camera buttons and the sheet handle.
- RGAA 4.1.2 / WCAG 2.1 AA for everything but the 3D rendering. Text contrast ≥ 4.5:1 on `--surface` over the stage, ≥ 3:1 for icons and focus rings.
- Camera transitions 400 ms ease-in-out; instant under `prefers-reduced-motion: reduce`.
- Hover tint: the kind colour mixed 35 % towards white. Selection highlight stays `#3ad06a`; `GHOST_ALPHA` stays 0.15.
- Performance budget unchanged: full load under 3 s, mean frame under 16.7 ms (WebGPU, Apple Silicon), with the drawer and a tool panel open.
- Interface strings in French in `strings.ts`; no request outside the application's origin.
- `localStorage` used only for the drawer state (key `haac.drawer`), every access in try/catch.

## Out of scope

- A readable tree: cleaning the FMA groups, dedupes, names and counts (gain 7).
- A new first screen: starting without skin, welcome hint (gain 8).
- A light theme, a theme switch.
- A view cube, an outline render pass.
- Hover on touch screens.
- Guided tours and mode switching (directions B and C).
- The quiz.
- Translating the interface out of French.
- Changes to the atlas data, the asset build or the rig.

## Further notes

- Mockup: the private canvas "Atlas UI refonte" on claude.ai, with a desktop board (1440 × 900) and a phone board (390 × 844). Its camera buttons are 36 px: the spec's 44 px wins. It uses Inter: the spec's system fonts win.
- Hovering already uses the BVH. The fix of 2026-11-10 patches `Mesh.raycast`. The per-move cost is well under a millisecond, which the label needs.
- The e2e selectors move from layout classes to roles and names where they do not already use them, so that later restyling does not break them.
