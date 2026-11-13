# Hazlaoum: a space mission design game

A 2D browser game made for the NASA Space Apps 2026 challenge *Space Mission Design Game*.

**Play it:** https://omar2010code.github.io/space-mission-game/

## What is in it

- **Chapter 1, the rocket workshop** (`rocket/`): pick a mission (Orbit and home, then Moon landing) and a science goal, build a rocket by dragging parts, and launch it.
  The spacecraft is three rooms: the Control room, the Communication room and Life support & shelter. When the design is complete (CML 4)
  it takes a streamlined, shuttle-style launch shape: the rooms become a winged spacecraft on one big fuel tank with boosters on its sides.
  Parts snap above, below or between each other; side boosters, solar panels and instruments snap onto the sides,
  with a mirror switch for pairs, and fuel tanks can be stretched. Every part costs money, adds mass and uses or makes electricity.
  The mission report says which step failed and why. New players can start with the Tutorial. Ideas from the challenge's NASA resources are built into the game:
  - **Science goal first** (from *A Learning Game About Telescopes*): the question you choose decides which instruments
    (camera, infrared spectrometer, radar sounder, magnetometer) the spacecraft must carry, and some goals are impossible at some places.
  - **Four mission segments** (from *Design and Develop Science Missions*): your rocket is the launch and space segments;
    you also choose a ground segment (one station, a station network or the Deep Space Network) and a user segment (a science team).
  - **Mission Design Lab review** (from NASA Goddard's MDL): before launch, engineers grade propulsion, power, thermal,
    ground and users, crew safety and cost as green, yellow or red, with advice.
  - **Concept Maturity Levels** (from JPL's CML framework): your design climbs from CML 1 (an idea) to CML 4 (a point design).
    Finishing a mission unlocks the next one.
- **Chapter 2, float in orbit** (`hazlaoum/`): explore the six rooms of the spacecraft in zero gravity. Press M for the ship map.

## Run it on your own computer

It is plain HTML and JavaScript with no build step. Serve the folder with any web server, for example:

```bash
python -m http.server 8123
```

Then open http://localhost:8123.

## Credits

Game art was generated with an AI image tool and cut into sprites. The numbers in the rocket workshop are simplified for play.
