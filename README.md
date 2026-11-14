# Hazlaoum: a space mission design game

A 2D browser game made for the NASA Space Apps 2026 challenge *Space Mission Design Game*.

**Play it:** https://omar2010code.github.io/space-mission-game/

## What is in it

The main menu has **Single player** (the story), **Multiplayer** and **Settings** (volume and fullscreen).

- **Multiplayer, Moon challenges** (`moon/multiplayer.js`): up to 4 players. Servers are listed in order (Server 1, 2, ...);
  join one or create your own. GitHub Pages cannot run a game server, so the player who creates a server hosts it in their
  own browser and the others connect straight to it (peer to peer, through free public relays with the Trystero library).
  - **Challenge 1, race to the rover:** each player starts at their own spacecraft. Take a sample from the rover and bring it
    back first. The board shows how far each opponent is from the rover, then from their own spacecraft.
  - **Challenge 2, materials hunt:** 2 minutes on one map. Materials lie 100 to 500 m apart; rarer ones are worth more
    (Moon rock 10, water ice 25, helium-3 crystal 50, meteorite gold 100). The highest score wins.
  - Open `moon/index.html?mp=local` to test with several tabs on one computer, without the internet.

- **Single player, the story** (`story/`): Mr. Hazalqoum is called for a mission. Build a spacecraft that passes the test and launch it.
  After leaving the atmosphere, a solar flare knocks out the power: run to the shelter room, find three batteries in the dark to wake
  the ship's AI, Alkabir, then reconnect the burned wires in the communication room. The ship turns to the Moon and lands, the last
  mission recovers the lost rover's sample, and the rocket lifts off for home. The game's chapters below are the parts of this story.
- **Chapter 1, the rocket workshop** (`rocket/`): pick a mission (Orbit and home, then Moon landing), build a rocket by dragging parts, and launch it.
  The spacecraft is three rooms: the Control room, the Communication room and Life support & shelter. When the design is complete (CML 4)
  it takes a streamlined, shuttle-style launch shape: the rooms become a winged spacecraft on one big fuel tank with boosters on its sides.
  Parts snap above, below or between each other; side boosters and solar panels snap onto the sides,
  with a mirror switch for pairs, and fuel tanks can be stretched. Every part costs money, adds mass and uses or makes electricity.
  The mission report says which step failed and why. New players can start with the Tutorial. Ideas from the challenge's NASA resources are built into the game:
  - **Safety margins and the Mission Design Lab review** (from NASA Goddard's MDL and JPL practice): before launch, engineers check
    propulsion, thermal, communication and crew safety, plus three margins: the rocket must still have enough Δv with the
    spacecraft 30% heavier, make 30% more electricity than it uses, and keep 30% of the budget in reserve. Only an approved design may launch.
  - **Concept Maturity Levels** (from JPL's CML paper): your design climbs from CML 1 (an idea) to CML 4 (a point design
    "with acceptable margins and reserves"). Finishing a mission unlocks the next one.
- **Chapter 2, float in orbit** (`hazlaoum/`): explore the three rooms of the spacecraft in zero gravity. Press M for the ship map.
- **Chapter 3, moon rescue** (`moon/`): drive a buggy across the Moon. Follow the lost rover's wheel tracks into the lunar night,
  with a marker every 200 m, take the sample it collected and bring it back to the lander within 4 minutes of oxygen.

## Run it on your own computer

It is plain HTML and JavaScript with no build step. Serve the folder with any web server, for example:

```bash
python -m http.server 8123
```

Then open http://localhost:8123.

## Credits

Game art was generated with an AI image tool and cut into sprites. The numbers in the rocket workshop are simplified for play.
