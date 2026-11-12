# Hazlaoum: a space mission design game

A 2D browser game made for the NASA Space Apps 2026 challenge *Space Mission Design Game*.

**Play it:** https://omar2010code.github.io/space-mission-game/

## What is in it

- **Chapter 1, the rocket workshop** (`rocket/`): pick a mission, build a rocket from parts, and launch it.
  Every part costs money, adds mass and uses or makes electricity. The mission report says which step failed and why.
  New players can start with the Tutorial.
- **Chapter 2, float in orbit** (`hazlaoum/`): explore the six rooms of the spacecraft in zero gravity. Press M for the ship map.

## Run it on your own computer

It is plain HTML and JavaScript with no build step. Serve the folder with any web server, for example:

```bash
python -m http.server 8123
```

Then open http://localhost:8123.

## Credits

Game art was generated with an AI image tool and cut into sprites. The numbers in the rocket workshop are simplified for play.
