// Source-derived metadata; expressions are evidence, not evaluated Lua.
export const WEAPON_PROFILES=[
  {
    "id": "ChainGun",
    "name": "Chain Gun",
    "category": "projectile",
    "continuous": false,
    "delayRange": [
      0.08,
      0.12
    ],
    "interval": 0.1,
    "source": "data/scripts/lib/weapongenerator.lua:614",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 619,
        "text": "    local reach = rand:getFloat(300, 450)"
      },
      {
        "line": 621,
        "text": "    local speed = rand:getFloat(500, 700)"
      },
      {
        "line": 629,
        "text": "    weapon.prefix = \"Chaingun /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 636,
        "text": "    weapon.impactParticles = ImpactParticles.Physical"
      },
      {
        "line": 637,
        "text": "    weapon.impactSound = 1"
      },
      {
        "line": 639,
        "text": "    weapon.psize = rand:getFloat(0.05, 0.2)"
      },
      {
        "line": 640,
        "text": "    weapon.pmaximumTime = existingTime"
      },
      {
        "line": 641,
        "text": "    weapon.pvelocity = speed"
      },
      {
        "line": 642,
        "text": "    weapon.pcolor = ColorHSV(rand:getFloat(10, 60), 0.7, 1)"
      },
      {
        "line": 644,
        "text": "    if rand:test(0.05) then"
      },
      {
        "line": 646,
        "text": "        weapon.shotsFired = shots[rand:getInt(1, #shots)]"
      },
      {
        "line": 647,
        "text": "        weapon.damage = (weapon.damage * 1.5) / weapon.shotsFired"
      },
      {
        "line": 651,
        "text": "    if rand:test(0.075) then"
      },
      {
        "line": 653,
        "text": "    elseif rand:test(0.075) then"
      },
      {
        "line": 655,
        "text": "    elseif rand:test(0.05) then"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1164",
    "turning": [
      {
        "line": 1183,
        "text": "    local scaleLevel = TurretGenerator.scale(rand, result, WeaponType.ChainGun, tech, 1, coaxialAllowed)"
      }
    ],
    "cooling": [],
    "special": null
  },
  {
    "id": "PointDefenseChainGun",
    "name": "Point Defense Chain Gun",
    "category": "projectile",
    "continuous": false,
    "delayRange": [
      0.075,
      0.1
    ],
    "interval": 0.0875,
    "source": "data/scripts/lib/weapongenerator.lua:665",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 670,
        "text": "    local reach = rand:getFloat(700, 750)"
      },
      {
        "line": 673,
        "text": "    local speed = rand:getFloat(1000, 1100)"
      },
      {
        "line": 681,
        "text": "    weapon.prefix = \"Point Defense Cannon /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 688,
        "text": "    weapon.impactParticles = ImpactParticles.Physical"
      },
      {
        "line": 689,
        "text": "    weapon.impactSound = 1"
      },
      {
        "line": 691,
        "text": "    weapon.psize = rand:getFloat(0.05, 0.2)"
      },
      {
        "line": 692,
        "text": "    weapon.pmaximumTime = existingTime"
      },
      {
        "line": 693,
        "text": "    weapon.pvelocity = speed"
      },
      {
        "line": 694,
        "text": "    weapon.pcolor = ColorHSV(rand:getFloat(10, 60), 0.7, 1)"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1211",
    "turning": [
      {
        "line": 1230,
        "text": "    local scaleLevel = TurretGenerator.scale(rand, result, WeaponType.PointDefenseChainGun, tech, 2, coaxialAllowed)"
      }
    ],
    "cooling": [],
    "special": null
  },
  {
    "id": "PointDefenseLaser",
    "name": "Point Defense Laser",
    "category": "beam",
    "continuous": true,
    "delayRange": [
      0.2,
      0.2
    ],
    "interval": 0.2,
    "source": "data/scripts/lib/weapongenerator.lua:300",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 305,
        "text": "    local reach = rand:getFloat(500, 600)"
      },
      {
        "line": 312,
        "text": "    weapon.continuousBeam = true"
      },
      {
        "line": 315,
        "text": "    weapon.prefix = \"Point Defense Laser /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 323,
        "text": "    weapon.blength = weapon.reach"
      },
      {
        "line": 325,
        "text": "    weapon.bouterColor = ColorHSV(hue, 1, rand:getFloat(0.1, 0.3))"
      },
      {
        "line": 326,
        "text": "    weapon.binnerColor = ColorHSV(hue + rand:getFloat(-120, 120), 0.3, rand:getFloat(0.7, 0.8))"
      },
      {
        "line": 327,
        "text": "    weapon.bshape = BeamShape.Straight"
      },
      {
        "line": 328,
        "text": "    weapon.bwidth = 0.5"
      },
      {
        "line": 329,
        "text": "    weapon.bauraWidth = 1"
      },
      {
        "line": 330,
        "text": "    weapon.banimationSpeed = 4"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1290",
    "turning": [
      {
        "line": 1309,
        "text": "    local scaleLevel = TurretGenerator.scale(rand, result, WeaponType.PointDefenseLaser, tech, 2, coaxialAllowed)"
      }
    ],
    "cooling": [],
    "special": null
  },
  {
    "id": "Laser",
    "name": "Laser",
    "category": "beam",
    "continuous": true,
    "delayRange": [
      0.2,
      0.2
    ],
    "interval": 0.2,
    "source": "data/scripts/lib/weapongenerator.lua:337",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 342,
        "text": "    local reach = rand:getFloat(450, 750)"
      },
      {
        "line": 348,
        "text": "    weapon.continuousBeam = true"
      },
      {
        "line": 351,
        "text": "    weapon.prefix = \"Laser /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 359,
        "text": "    weapon.blength = weapon.reach"
      },
      {
        "line": 362,
        "text": "    if rand:test(0.1) then"
      },
      {
        "line": 366,
        "text": "    weapon.bouterColor = ColorHSV(hue, 1, rand:getFloat(0.1, 0.3))"
      },
      {
        "line": 367,
        "text": "    weapon.binnerColor = ColorHSV(hue + rand:getFloat(-120, 120), 0.3, rand:getFloat(0.7, 0.8))"
      },
      {
        "line": 368,
        "text": "    weapon.bshape = BeamShape.Straight"
      },
      {
        "line": 369,
        "text": "    weapon.bwidth = 0.5"
      },
      {
        "line": 370,
        "text": "    weapon.bauraWidth = 1"
      },
      {
        "line": 371,
        "text": "    weapon.banimationSpeed = 4"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1244",
    "turning": [
      {
        "line": 1261,
        "text": "    local scaleLevel = TurretGenerator.scale(rand, result, WeaponType.Laser, tech, 0.75, coaxialAllowed)"
      }
    ],
    "cooling": [
      {
        "line": 1263,
        "text": "    local rechargeTime = 30 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1264,
        "text": "    local shootingTime = 20 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1265,
        "text": "    TurretGenerator.createBatteryChargeCooling(result, rechargeTime, shootingTime)"
      }
    ],
    "special": null
  },
  {
    "id": "MiningLaser",
    "name": "Mining Laser",
    "category": "beam",
    "continuous": true,
    "delayRange": [
      0.2,
      0.2
    ],
    "interval": 0.2,
    "source": "data/scripts/lib/weapongenerator.lua:57",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 65,
        "text": "    weapon.continuousBeam = true"
      },
      {
        "line": 68,
        "text": "    weapon.prefix = \"Mining /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 79,
        "text": "    weapon.bshape = BeamShape.Straight"
      },
      {
        "line": 80,
        "text": "    weapon.bouterColor = ColorRGB(0.1, 0.1, 0.1)"
      },
      {
        "line": 81,
        "text": "    weapon.binnerColor = ColorARGB(material.color.a * 0.5, material.color.r * 0.5, material.color.g * 0.5, material.color.b * 0.5)"
      },
      {
        "line": 82,
        "text": "    weapon.bwidth = 0.5"
      },
      {
        "line": 83,
        "text": "    weapon.bauraWidth = 1"
      },
      {
        "line": 84,
        "text": "    weapon.banimationSpeed = 4"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1323",
    "turning": [
      {
        "line": 1346,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.MiningLaser, tech, 0.8, false)"
      }
    ],
    "cooling": [],
    "special": null
  },
  {
    "id": "RawMiningLaser",
    "name": "Raw Mining Laser",
    "category": "beam",
    "continuous": true,
    "delayRange": [
      0.2,
      0.2
    ],
    "interval": 0.2,
    "source": "data/scripts/lib/weapongenerator.lua:126",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 134,
        "text": "    weapon.continuousBeam = true"
      },
      {
        "line": 137,
        "text": "    weapon.prefix = \"R-Mining /* Weapon Prefix*/\"%_T -- keep for legacy compatibility"
      },
      {
        "line": 139,
        "text": "    weapon.prefix = \"R-Mining /* Weapon Prefix, the R- abbreviation refers to Raw Mining */\"%_T"
      },
      {
        "line": 150,
        "text": "    weapon.blength = weapon.reach"
      },
      {
        "line": 151,
        "text": "    weapon.bshape = BeamShape.Straight"
      },
      {
        "line": 152,
        "text": "    weapon.bouterColor = ColorRGB(0.1, 0.1, 0.1)"
      },
      {
        "line": 153,
        "text": "    weapon.binnerColor = ColorARGB(material.color.a * 0.5, material.color.r * 0.5, material.color.g * 0.5, material.color.b * 0.5)"
      },
      {
        "line": 154,
        "text": "    weapon.bwidth = 0.5"
      },
      {
        "line": 155,
        "text": "    weapon.bauraWidth = 1"
      },
      {
        "line": 156,
        "text": "    weapon.banimationSpeed = 4"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1410",
    "turning": [
      {
        "line": 1433,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.RawMiningLaser, tech, 0.8, false)"
      }
    ],
    "cooling": [],
    "special": null
  },
  {
    "id": "SalvagingLaser",
    "name": "Salvaging Laser",
    "category": "beam",
    "continuous": true,
    "delayRange": [
      0.2,
      0.2
    ],
    "interval": 0.2,
    "source": "data/scripts/lib/weapongenerator.lua:91",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 99,
        "text": "    weapon.continuousBeam = true"
      },
      {
        "line": 102,
        "text": "    weapon.prefix = \"Salvaging /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 113,
        "text": "    weapon.blength = weapon.reach"
      },
      {
        "line": 114,
        "text": "    weapon.bshape = BeamShape.Straight"
      },
      {
        "line": 115,
        "text": "    weapon.bouterColor = ColorRGB(0.1, 0.1, 0.1)"
      },
      {
        "line": 116,
        "text": "    weapon.binnerColor = ColorARGB(material.color.a * 0.5, material.color.r * 0.5, material.color.g * 0.5, material.color.b * 0.5)"
      },
      {
        "line": 117,
        "text": "    weapon.bwidth = 0.5"
      },
      {
        "line": 118,
        "text": "    weapon.bauraWidth = 1"
      },
      {
        "line": 119,
        "text": "    weapon.banimationSpeed = 4"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1371",
    "turning": [
      {
        "line": 1391,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.SalvagingLaser, tech, 0.8, false)"
      }
    ],
    "cooling": [],
    "special": null
  },
  {
    "id": "RawSalvagingLaser",
    "name": "Raw Salvaging Laser",
    "category": "beam",
    "continuous": true,
    "delayRange": [
      0.2,
      0.2
    ],
    "interval": 0.2,
    "source": "data/scripts/lib/weapongenerator.lua:163",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 171,
        "text": "    weapon.continuousBeam = true"
      },
      {
        "line": 174,
        "text": "    weapon.prefix = \"R-Salvaging /* Weapon Prefix*/\"%_T -- keep for legacy compatibility"
      },
      {
        "line": 176,
        "text": "    weapon.prefix = \"R-Salvaging /* Weapon Prefix, the R- abbreviation refers to Raw Salvaging */\"%_T"
      },
      {
        "line": 187,
        "text": "    weapon.blength = weapon.reach"
      },
      {
        "line": 188,
        "text": "    weapon.bshape = BeamShape.Straight"
      },
      {
        "line": 189,
        "text": "    weapon.bouterColor = ColorRGB(0.1, 0.1, 0.1)"
      },
      {
        "line": 190,
        "text": "    weapon.binnerColor = ColorARGB(material.color.a * 0.5, material.color.r * 0.5, material.color.g * 0.5, material.color.b * 0.5)"
      },
      {
        "line": 191,
        "text": "    weapon.bwidth = 0.5"
      },
      {
        "line": 192,
        "text": "    weapon.bauraWidth = 1"
      },
      {
        "line": 193,
        "text": "    weapon.banimationSpeed = 4"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1452",
    "turning": [
      {
        "line": 1472,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.RawSalvagingLaser, tech, 0.8, false)"
      }
    ],
    "cooling": [],
    "special": null
  },
  {
    "id": "PlasmaGun",
    "name": "Plasma Gun",
    "category": "projectile",
    "continuous": false,
    "delayRange": [
      0.15,
      0.2
    ],
    "interval": 0.175,
    "source": "data/scripts/lib/weapongenerator.lua:703",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 708,
        "text": "    local reach = rand:getFloat(550, 800)"
      },
      {
        "line": 710,
        "text": "    local speed = rand:getFloat(500, 700)"
      },
      {
        "line": 718,
        "text": "    weapon.prefix = \"Plasma /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 725,
        "text": "    weapon.impactParticles = ImpactParticles.Energy"
      },
      {
        "line": 726,
        "text": "    weapon.impactSound = 1"
      },
      {
        "line": 727,
        "text": "    weapon.pshape = ProjectileShape.Plasma"
      },
      {
        "line": 732,
        "text": "    weapon.psize = rand:getFloat(0.4, 0.8)"
      },
      {
        "line": 733,
        "text": "    weapon.pmaximumTime = existingTime"
      },
      {
        "line": 734,
        "text": "    weapon.pvelocity = speed"
      },
      {
        "line": 735,
        "text": "    weapon.pcolor = ColorHSV(rand:getFloat(0, 360), 0.7, 1)"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1497",
    "turning": [
      {
        "line": 1520,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.PlasmaGun, tech, 0.7, coaxialAllowed)"
      }
    ],
    "cooling": [
      {
        "line": 1515,
        "text": "    local rechargeTime = 20 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1516,
        "text": "    local shootingTime = 15 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1517,
        "text": "    TurretGenerator.createBatteryChargeCooling(result, rechargeTime, shootingTime)"
      }
    ],
    "special": null
  },
  {
    "id": "RocketLauncher",
    "name": "Rocket Launcher",
    "category": "projectile",
    "continuous": false,
    "delayRange": [
      0.5,
      1.5
    ],
    "interval": 1,
    "source": "data/scripts/lib/weapongenerator.lua:744",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 749,
        "text": "    local reach = rand:getFloat(1300, 1800)"
      },
      {
        "line": 751,
        "text": "    local speed = rand:getFloat(150, 200)"
      },
      {
        "line": 757,
        "text": "    weapon.seeker = rand:test(1 / 8)"
      },
      {
        "line": 760,
        "text": "    weapon.prefix = \"Launcher /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 767,
        "text": "    weapon.impactParticles = ImpactParticles.Explosion"
      },
      {
        "line": 768,
        "text": "    weapon.impactSound = 1"
      },
      {
        "line": 769,
        "text": "    weapon.impactExplosion = true"
      },
      {
        "line": 772,
        "text": "    if rand:test(0.1) then"
      },
      {
        "line": 776,
        "text": "    weapon.psize = rand:getFloat(0.2, 0.4)"
      },
      {
        "line": 777,
        "text": "    weapon.pmaximumTime = existingTime"
      },
      {
        "line": 778,
        "text": "    weapon.pvelocity = speed"
      },
      {
        "line": 779,
        "text": "    weapon.pcolor = ColorHSV(rand:getFloat(10, 60), 0.7, 1)"
      },
      {
        "line": 780,
        "text": "    weapon.pshape = ProjectileShape.Rocket"
      },
      {
        "line": 782,
        "text": "    if rand:test(0.05) then"
      },
      {
        "line": 784,
        "text": "        weapon.shotsFired = shots[rand:getInt(1, #shots)]"
      },
      {
        "line": 785,
        "text": "        weapon.damage = (weapon.damage * 1.5) / weapon.shotsFired"
      },
      {
        "line": 792,
        "text": "    weapon.explosionRadius = math.sqrt(weapon.damage * 5)"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1538",
    "turning": [
      {
        "line": 1572,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.RocketLauncher, tech, 0.6, coaxialAllowed)"
      }
    ],
    "cooling": [
      {
        "line": 1568,
        "text": "    local shootingTime = 20 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1569,
        "text": "    local coolingTime = 15 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1570,
        "text": "    TurretGenerator.createStandardCooling(result, coolingTime, shootingTime)"
      }
    ],
    "special": null
  },
  {
    "id": "Cannon",
    "name": "Cannon",
    "category": "projectile",
    "continuous": false,
    "delayRange": [
      1.5,
      2.5
    ],
    "interval": 2,
    "source": "data/scripts/lib/weapongenerator.lua:797",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 802,
        "text": "    local reach = rand:getFloat(1100, 1500)"
      },
      {
        "line": 804,
        "text": "    local speed = rand:getFloat(600, 800)"
      },
      {
        "line": 812,
        "text": "    weapon.prefix = \"Cannon /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 819,
        "text": "    weapon.impactParticles = ImpactParticles.Explosion"
      },
      {
        "line": 820,
        "text": "    weapon.impactSound = 1"
      },
      {
        "line": 821,
        "text": "    weapon.impactExplosion = true"
      },
      {
        "line": 824,
        "text": "    if rand:test(0.1) then"
      },
      {
        "line": 828,
        "text": "    weapon.psize = rand:getFloat(0.2, 0.5)"
      },
      {
        "line": 829,
        "text": "    weapon.pmaximumTime = existingTime"
      },
      {
        "line": 830,
        "text": "    weapon.pvelocity = speed"
      },
      {
        "line": 831,
        "text": "    weapon.pcolor = ColorHSV(rand:getFloat(10, 60), 0.7, 1)"
      },
      {
        "line": 837,
        "text": "    weapon.explosionRadius = math.sqrt(weapon.damage * 5)"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1601",
    "turning": [
      {
        "line": 1623,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.Cannon, tech, 0.5, coaxialAllowed)"
      }
    ],
    "cooling": [
      {
        "line": 1619,
        "text": "    local shootingTime = 25 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1620,
        "text": "    local coolingTime = 15 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1621,
        "text": "    TurretGenerator.createStandardCooling(result, coolingTime, shootingTime)"
      }
    ],
    "special": null
  },
  {
    "id": "RailGun",
    "name": "Rail Gun",
    "category": "beam",
    "continuous": false,
    "delayRange": [
      1,
      2.5
    ],
    "interval": 1.75,
    "source": "data/scripts/lib/weapongenerator.lua:421",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 426,
        "text": "    local reach = rand:getFloat(950, 1400)"
      },
      {
        "line": 432,
        "text": "    weapon.continuousBeam = false"
      },
      {
        "line": 435,
        "text": "    weapon.prefix = \"Railgun /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 442,
        "text": "    weapon.impactParticles = ImpactParticles.Physical"
      },
      {
        "line": 443,
        "text": "    weapon.impactSound = 1"
      },
      {
        "line": 444,
        "text": "    weapon.blockPenetration = rand:getInt(3, 5 + rarity.value * 2)"
      },
      {
        "line": 447,
        "text": "    if rand:test(0.1) then"
      },
      {
        "line": 451,
        "text": "    weapon.blength = weapon.reach"
      },
      {
        "line": 452,
        "text": "    weapon.bshape = BeamShape.Straight"
      },
      {
        "line": 453,
        "text": "    weapon.bwidth = 0.5"
      },
      {
        "line": 454,
        "text": "    weapon.bauraWidth = 3"
      },
      {
        "line": 455,
        "text": "    weapon.banimationSpeed = 1"
      },
      {
        "line": 456,
        "text": "    weapon.banimationAcceleration = -2"
      },
      {
        "line": 458,
        "text": "    if rand:getBool() then"
      },
      {
        "line": 460,
        "text": "        weapon.bouterColor = ColorHSV(rand:getFloat(10, 60), rand:getFloat(0.5, 1), rand:getFloat(0.1, 0.5))"
      },
      {
        "line": 461,
        "text": "        weapon.binnerColor = ColorHSV(rand:getFloat(10, 60), rand:getFloat(0.1, 0.5), 1)"
      },
      {
        "line": 462,
        "text": "    else"
      },
      {
        "line": 464,
        "text": "        weapon.bouterColor = ColorHSV(rand:getFloat(180, 260), rand:getFloat(0.5, 1), rand:getFloat(0.1, 0.5))"
      },
      {
        "line": 465,
        "text": "        weapon.binnerColor = ColorHSV(rand:getFloat(180, 260), rand:getFloat(0.1, 0.5), 1)"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1646",
    "turning": [
      {
        "line": 1668,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.RailGun, tech, 0.5, coaxialAllowed)"
      }
    ],
    "cooling": [
      {
        "line": 1664,
        "text": "    local shootingTime = 27.5 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1665,
        "text": "    local coolingTime = 10 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1666,
        "text": "    TurretGenerator.createStandardCooling(result, coolingTime, shootingTime)"
      }
    ],
    "special": null
  },
  {
    "id": "RepairBeam",
    "name": "Repair Beam",
    "category": "beam",
    "continuous": true,
    "delayRange": [
      0.2,
      0.2
    ],
    "interval": 0.2,
    "source": "data/scripts/lib/weapongenerator.lua:378",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 383,
        "text": "    local reach = rand:getFloat(200, 300)"
      },
      {
        "line": 388,
        "text": "    weapon.continuousBeam = true"
      },
      {
        "line": 391,
        "text": "    weapon.prefix = \"Repair /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 396,
        "text": "    weapon.impactParticles = ImpactParticles.Energy"
      },
      {
        "line": 397,
        "text": "    if rand:test(0.5) then"
      },
      {
        "line": 399,
        "text": "        weapon.bouterColor = ColorRGB(0.1, 0.2, 0.4)"
      },
      {
        "line": 400,
        "text": "        weapon.binnerColor = ColorRGB(0.2, 0.4, 0.9)"
      },
      {
        "line": 401,
        "text": "    else"
      },
      {
        "line": 403,
        "text": "        weapon.bouterColor = ColorARGB(0.5, 0, 0.5, 0)"
      },
      {
        "line": 404,
        "text": "        weapon.binnerColor = ColorRGB(1, 1, 1)"
      },
      {
        "line": 409,
        "text": "    weapon.blength = weapon.reach"
      },
      {
        "line": 410,
        "text": "    weapon.bwidth = 0.5"
      },
      {
        "line": 411,
        "text": "    weapon.bauraWidth = 1"
      },
      {
        "line": 412,
        "text": "    weapon.banimationSpeed = 4"
      },
      {
        "line": 413,
        "text": "    weapon.bshapeSize = 2"
      },
      {
        "line": 414,
        "text": "    weapon.bshape = BeamShape.Swirly"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1694",
    "turning": [
      {
        "line": 1746,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.RepairBeam, tech, 1, coaxialAllowed)"
      }
    ],
    "cooling": [
      {
        "line": 1742,
        "text": "    local rechargeTime = 15 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1743,
        "text": "    local shootingTime = 10 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1744,
        "text": "    TurretGenerator.createBatteryChargeCooling(result, rechargeTime, shootingTime)"
      }
    ],
    "special": "Hull, shield, or dual repair"
  },
  {
    "id": "Bolter",
    "name": "Bolter",
    "category": "projectile",
    "continuous": false,
    "delayRange": [
      0.1,
      0.3
    ],
    "interval": 0.2,
    "source": "data/scripts/lib/weapongenerator.lua:9",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 14,
        "text": "    local reach = rand:getFloat(650, 700)"
      },
      {
        "line": 16,
        "text": "    local velocity = rand:getFloat(800, 1000)"
      },
      {
        "line": 19,
        "text": "    weapon.pvelocity = velocity"
      },
      {
        "line": 25,
        "text": "    weapon.prefix = \"Bolter /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 32,
        "text": "    weapon.impactParticles = ImpactParticles.Physical"
      },
      {
        "line": 33,
        "text": "    weapon.impactSound = 1"
      },
      {
        "line": 38,
        "text": "    weapon.psize = rand:getFloat(0.15, 0.25)"
      },
      {
        "line": 39,
        "text": "    weapon.pmaximumTime = maximumTime"
      },
      {
        "line": 42,
        "text": "    weapon.pcolor = color"
      },
      {
        "line": 44,
        "text": "    if rand:test(0.05) then"
      },
      {
        "line": 46,
        "text": "        weapon.shotsFired = shots[rand:getInt(1, #shots)]"
      },
      {
        "line": 47,
        "text": "        weapon.damage = weapon.damage * 1.5 / weapon.shotsFired"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1103",
    "turning": [
      {
        "line": 1136,
        "text": "    local scaleLevel = TurretGenerator.scale(rand, result, WeaponType.Bolter, tech, 0.7, coaxialAllowed)"
      }
    ],
    "cooling": [
      {
        "line": 1122,
        "text": "    local shootingTime = 7 * rand:getFloat(0.9, 1.3)"
      },
      {
        "line": 1123,
        "text": "    local coolingTime = 5 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1125,
        "text": "    TurretGenerator.createStandardCooling(result, coolingTime, shootingTime)"
      },
      {
        "line": 1132,
        "text": "        weapon.damage = weapon.damage * ((coolingTime + shootingTime) / shootingTime)"
      }
    ],
    "special": null
  },
  {
    "id": "LightningGun",
    "name": "Lightning Gun",
    "category": "beam",
    "continuous": false,
    "delayRange": [
      1,
      2.5
    ],
    "interval": 1.75,
    "source": "data/scripts/lib/weapongenerator.lua:200",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 205,
        "text": "    local reach = rand:getFloat(950, 1400)"
      },
      {
        "line": 211,
        "text": "    weapon.continuousBeam = false"
      },
      {
        "line": 214,
        "text": "    weapon.prefix = \"Lightning /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 221,
        "text": "    weapon.impactParticles = ImpactParticles.Energy"
      },
      {
        "line": 223,
        "text": "    weapon.impactSound = 1"
      },
      {
        "line": 229,
        "text": "    if rand:test(0.1) then"
      },
      {
        "line": 233,
        "text": "    weapon.blength = weapon.reach"
      },
      {
        "line": 234,
        "text": "    weapon.bshape = BeamShape.Lightning"
      },
      {
        "line": 235,
        "text": "    weapon.bwidth = 0.5"
      },
      {
        "line": 236,
        "text": "    weapon.bauraWidth = 3"
      },
      {
        "line": 237,
        "text": "    weapon.banimationSpeed = 0"
      },
      {
        "line": 238,
        "text": "    weapon.banimationAcceleration = 0"
      },
      {
        "line": 239,
        "text": "    weapon.bshapeSize = 13"
      },
      {
        "line": 242,
        "text": "    weapon.bouterColor = ColorHSV(rand:getFloat(180, 260), rand:getFloat(0.5, 1), rand:getFloat(0.1, 0.5))"
      },
      {
        "line": 243,
        "text": "    weapon.binnerColor = ColorHSV(rand:getFloat(180, 260), rand:getFloat(0.1, 0.5), 1)"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1769",
    "turning": [
      {
        "line": 1791,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.LightningGun, tech, 0.5, coaxialAllowed)"
      }
    ],
    "cooling": [
      {
        "line": 1787,
        "text": "    local rechargeTime = 20 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1788,
        "text": "    local shootingTime = 15 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1789,
        "text": "    TurretGenerator.createBatteryChargeCooling(result, rechargeTime, shootingTime)"
      }
    ],
    "special": null
  },
  {
    "id": "TeslaGun",
    "name": "Tesla Gun",
    "category": "beam",
    "continuous": true,
    "delayRange": [
      0.2,
      0.2
    ],
    "interval": 0.2,
    "source": "data/scripts/lib/weapongenerator.lua:252",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 257,
        "text": "    local reach = rand:getFloat(250, 350)"
      },
      {
        "line": 263,
        "text": "    weapon.continuousBeam = true"
      },
      {
        "line": 266,
        "text": "    weapon.prefix = \"Tesla /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 275,
        "text": "    weapon.impactParticles = ImpactParticles.Energy"
      },
      {
        "line": 277,
        "text": "    weapon.blength = weapon.reach"
      },
      {
        "line": 283,
        "text": "    if rand:test(0.1) then"
      },
      {
        "line": 287,
        "text": "    weapon.bouterColor = ColorHSV(hue, 1, rand:getFloat(0.1, 0.3))"
      },
      {
        "line": 288,
        "text": "    weapon.binnerColor = ColorHSV(hue + rand:getFloat(-120, 120), 0.3, rand:getFloat(0.7, 0.8))"
      },
      {
        "line": 289,
        "text": "    weapon.bwidth = 0.5"
      },
      {
        "line": 290,
        "text": "    weapon.bauraWidth = 1"
      },
      {
        "line": 291,
        "text": "    weapon.banimationSpeed = 4"
      },
      {
        "line": 292,
        "text": "    weapon.bshape = BeamShape.Lightning"
      },
      {
        "line": 293,
        "text": "    weapon.bshapeSize = 5"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1818",
    "turning": [
      {
        "line": 1840,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.TeslaGun, tech, 0.5, coaxialAllowed)"
      }
    ],
    "cooling": [
      {
        "line": 1836,
        "text": "    local rechargeTime = 20 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1837,
        "text": "    local shootingTime = 15 * rand:getFloat(0.8, 1.2)"
      },
      {
        "line": 1838,
        "text": "    TurretGenerator.createBatteryChargeCooling(result, rechargeTime, shootingTime)"
      }
    ],
    "special": null
  },
  {
    "id": "ForceGun",
    "name": "Force Gun",
    "category": "beam",
    "continuous": true,
    "delayRange": [
      0.2,
      0.2
    ],
    "interval": 0.2,
    "source": "data/scripts/lib/weapongenerator.lua:475",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 483,
        "text": "    local reach = rand:getFloat(450, 550)"
      },
      {
        "line": 488,
        "text": "    weapon.continuousBeam = true"
      },
      {
        "line": 491,
        "text": "    weapon.prefix = \"Force /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 510,
        "text": "    weapon.impactParticles = ImpactParticles.Energy"
      },
      {
        "line": 511,
        "text": "    weapon.blength = weapon.reach"
      },
      {
        "line": 512,
        "text": "    weapon.banimationSpeed = 1"
      },
      {
        "line": 514,
        "text": "    weapon.bouterColor = ColorHSV(40, 1, 0.1)"
      },
      {
        "line": 515,
        "text": "    weapon.binnerColor = ColorHSV(40, 0.3, 0.3)"
      },
      {
        "line": 516,
        "text": "    weapon.bwidth = 2.0"
      },
      {
        "line": 517,
        "text": "    weapon.bauraWidth = 1"
      },
      {
        "line": 518,
        "text": "    weapon.banimationSpeed = 4"
      },
      {
        "line": 519,
        "text": "    weapon.bshape = BeamShape.Straight"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1867",
    "turning": [
      {
        "line": 1900,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.ForceGun, tech, 2, coaxialAllowed)"
      }
    ],
    "cooling": [],
    "special": "Straight plus swirly layer size 1.25"
  },
  {
    "id": "PulseCannon",
    "name": "Pulse Cannon",
    "category": "projectile",
    "continuous": false,
    "delayRange": [
      0.05,
      0.2
    ],
    "interval": 0.125,
    "source": "data/scripts/lib/weapongenerator.lua:524",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 532,
        "text": "    local reach = rand:getFloat(450, 750)"
      },
      {
        "line": 534,
        "text": "    local speed = rand:getFloat(700, 800)"
      },
      {
        "line": 542,
        "text": "    weapon.prefix = \"Pulse Cannon /* Weapon Prefix*/\"%_T"
      },
      {
        "line": 549,
        "text": "    weapon.impactParticles = ImpactParticles.Energy"
      },
      {
        "line": 550,
        "text": "    weapon.impactSound = 1"
      },
      {
        "line": 552,
        "text": "    weapon.psize = rand:getFloat(0.08, 0.3)"
      },
      {
        "line": 553,
        "text": "    weapon.pmaximumTime = existingTime"
      },
      {
        "line": 554,
        "text": "    weapon.pvelocity = speed"
      },
      {
        "line": 555,
        "text": "    weapon.pcolor = ColorHSV(rand:getFloat(180, 290), 0.7, 1)"
      },
      {
        "line": 558,
        "text": "    if rand:test(0.1) then"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1920",
    "turning": [
      {
        "line": 1952,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.PulseCannon, tech, 0.8, coaxialAllowed)"
      }
    ],
    "cooling": [
      {
        "line": 1938,
        "text": "    local shootingTime = 15 * rand:getFloat(1, 1.5)"
      },
      {
        "line": 1939,
        "text": "    local coolingTime = 5 * rand:getFloat(1, 1.5)"
      },
      {
        "line": 1941,
        "text": "    TurretGenerator.createStandardCooling(result, coolingTime, shootingTime)"
      },
      {
        "line": 1948,
        "text": "        weapon.damage = weapon.damage * ((coolingTime + shootingTime) / shootingTime)"
      }
    ],
    "special": null
  },
  {
    "id": "AntiFighter",
    "name": "Anti Fighter",
    "category": "projectile",
    "continuous": false,
    "delayRange": [
      2,
      2.5
    ],
    "interval": 2.25,
    "source": "data/scripts/lib/weapongenerator.lua:569",
    "confidence": "Source assignments; midpoint representative, native defaults unverified",
    "expressions": [
      {
        "line": 576,
        "text": "    local reach = rand:getFloat(300, 350)"
      },
      {
        "line": 580,
        "text": "    local speed = rand:getFloat(300, 400)"
      },
      {
        "line": 588,
        "text": "    weapon.prefix = \"Anti-Fighter /* Weapon Prefix */\"%_T"
      },
      {
        "line": 595,
        "text": "    weapon.impactParticles = ImpactParticles.DustExplosion"
      },
      {
        "line": 596,
        "text": "    weapon.impactSound = 1"
      },
      {
        "line": 597,
        "text": "    weapon.deathExplosion = true"
      },
      {
        "line": 598,
        "text": "    weapon.timedDeath = true"
      },
      {
        "line": 599,
        "text": "    weapon.explosionRadius = 35"
      },
      {
        "line": 601,
        "text": "    weapon.psize = rand:getFloat(0.3, 0.3)"
      },
      {
        "line": 602,
        "text": "    weapon.pmaximumTime = existingTime"
      },
      {
        "line": 603,
        "text": "    weapon.pvelocity = speed"
      },
      {
        "line": 604,
        "text": "    weapon.pcolor = ColorHSV(rand:getFloat(10, 60), 0.7, 1)"
      }
    ],
    "turretSource": "data/scripts/lib/turretgenerator.lua:1984",
    "turning": [
      {
        "line": 2001,
        "text": "    TurretGenerator.scale(rand, result, WeaponType.AntiFighter, tech, 1.2, coaxialAllowed)"
      }
    ],
    "cooling": [],
    "special": null
  }
];
export function resolveProfile(id){const p=WEAPON_PROFILES.find(p=>p.id===id);if(!p)throw Error("Unknown weapon family");return structuredClone(p);}
export function nativeTurningSpeed(value,unit){if(unit!=="degrees"&&unit!=="radians")throw Error("Native turning-speed units are unverified; specify a verified conversion.");return unit==="radians"?value*180/Math.PI:value;}
