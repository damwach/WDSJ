# Athlete reference photographs (offline package)

These **five actual photographs** are exclusively visual references for a new rigged WDSJ ski jumper. They are not game textures or assets to include in production builds.

Use in this order; verify the model's silhouettes against the photo before/after renders:

| File | Subject / art direction | Photographer / copyright | Image license | Source |
|---|---|---|---|---|
| `01_prevc_flight_side.jpg` | Peter Prevc, lateral-ish stable V flight. Primary reference for body line, arm/head angles, boot and ski separation. | Wladyslaw Sojka / Taxiarchos228 | [Free Art License (FAL)](https://artlibre.org/licence/lal/en/) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:FIS_Ski_Weltcup_Titisee-Neustadt_2016_-_Peter_Prevc1_(cropped).jpg) |
| `02_v_front.jpg` | Woman ski jumper, front V flight. Check hip/leg proportions, arms, V spread. | Sandro Halank | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:2021-08-28_FIS_Sommer_Grand_Prix_2021_Oberhof_and_Steinbach-Hallenberg_(Women%27s_Ski_Jumping)_by_Sandro_Halank%E2%80%93032.jpg) |
| `03_hvala_threequarter.jpg` | Jaka Hvala in flight, three-quarter silhouette, boot-to-ski geometry. | Bjoertvedt | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Hvala_Jaka_SLO_IMG_9144.JPG) |
| `04_schmitt_front_threequarter.jpg` | Thorsten Schmitt in flight, front/three-quarter head-arm-ski relations. | Alexander Nilssen | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Thorsten_Schmitt_jumps_from_Holmenkollen.jpg) |
| `05_stoch_telemark.jpg` | Kamil Stoch, telemark; separate landing reference. | Christian Bier | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:2017-10-03_FIS_SGP_2017_Klingenthal_Kamil_Stoch_Telemark.jpg) |

### Required visual check

- Compare 3D renders against photographs from matched camera directions and approximate perspective.
- Check realistic proportions, spine/head line, relaxed shoulders/arms, legs, boots, two separated skis, and V geometry.
- Do **not** trace photographic pixels as a 3D texture and do not treat a single perspective projection as a calibrated anatomical measurement.
- Preserve separately simulated skis and passive binding mechanics. Use a skeletal/skin deformation model, not additional tubes.
- Include before/after screenshots, especially flight side and front, and flag any unverified subjective comparisons.

### Attribution / usage

Each photograph is copyrighted by its indicated photographer and is independently licensed as above. Preserve credits, source-page links and license URLs when copying the images to another location. If changing (e.g., cropping) any photo, indicate modifications and honor the corresponding license's share-alike and credit conditions. This repository's source-code license **does not replace** the image-specific licenses. The first Prevc photograph is under Free Art License, not CC BY-SA.

These files are intended for **reference only**, and are not packaged in the game or served by GitHub Pages.

The downloadable subset is capped near 1280 pixels where available; some source originals are smaller.
