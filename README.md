# Your GitHub Learning Lab Repository for Introducing GitHub

Welcome to **your** repository for your GitHub Learning Lab course. This repository will be used during the different activities that I will be guiding you through. See a word you don't understand? We've included an emoji 📖 next to some key terms. Click on it to see its definition.

Oh! I haven't introduced myself...

I'm the GitHub Learning Lab bot and I'm here to help guide you in your journey to learn and master the various topics covered in this course. I will be using Issue and Pull Request comments to communicate with you. In fact, I already added an issue for you to check out.

![issue tab](https://lab.github.com/public/images/issue_tab.png)

I'll meet you over there, can't wait to get started!

This course is using the :sparkles: open source project [reveal.js](https://github.com/hakimel/reveal.js/). In some cases we’ve made changes to the history so it would behave during class, so head to the original project repo to learn more about the cool people behind this project.

## Fly connectome simulation demo

`fly-brain-sim/` is a self-contained, dependency-free web page that runs a scaled-down spiking model of the complete male *Drosophila* central nervous system announced by Google Research, Janelia, the MRC LMB and Cambridge on 3 September 2026 (166,700 neurons, ~125 million synapses, 11,710 cell types). Neurons are leaky integrate-and-fire units with the parameters of Shiu et al. (Nature, 2024); the wiring is generated to match the connectome's region structure and a few published sensorimotor pathways, and a real edge list exported from neuPrint or FlyWire can be loaded in its place.

`fly-brain-sim/flight.html` puts the same brain in a body: a 3D fly (three.js) whose eyes see a lamp in an arena, and whose steering descending neurons, flight descending neurons, giant fiber and wing motor neurons take off, steer toward the lamp and land. The closed loop lives in `fly-brain-sim/fly.js` and runs in node as well as the browser.

Open `fly-brain-sim/index.html` or `fly-brain-sim/flight.html` directly in a browser, or run the slideshow (`script/server`) and step to the "Live simulation" slides.
