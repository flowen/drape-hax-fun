import {
	WebGLRenderer,
	DoubleSide,
	ParametricGeometry,
	Scene,
	MeshPhongMaterial,
	Fog,
	PlaneBufferGeometry,
	Mesh, 
	SphereGeometry,
	PerspectiveCamera,
	PointLight,
	AmbientLight,
	DirectionalLight,
	TextureLoader,
	ShaderMaterial,
	RepeatWrapping,
	Math as tMath,
	Vector3
} from 'three';

//node.js
import loop from 'raf-loop';
import WAGNER from '@superguigui/wagner';
import BloomPass from '@superguigui/wagner/src/passes/bloom/MultiPassBloomPass';
import FXAAPass from '@superguigui/wagner/src/passes/fxaa/FXAAPass';
import Noise from '@superguigui/wagner/src/passes/noise/noise';
import VignettePass from '@superguigui/wagner/src/passes/vignette/VignettePass';
import DOFPass from '@superguigui/wagner/src/passes/dof/DOFPass';
import resize from 'brindille-resize';

// audio analyser and averager
import audioPlayer from 'web-audio-player';
import createAnalyser from 'web-audio-analyser';
import average from 'analyser-frequency-average';
import createAudioContext from 'ios-safe-audio-context';

//three.js
import OrbitControls from './controls/OrbitControls';

// models

//utilities
import mathMap from './utils/math.map';
import player from './utils/audioplayer';
import { audioUtil, analyser, bands } from './utils/analyser';

import h from './utils/helpers';
import {gui} from './utils/debug';

import {gui as datgui} from 'dat-gui';

/* Custom variables */
var time = 0;

/* Custom settings */
const SETTINGS = {
  useComposer: true,
  focalDistance : 4
};

/* Init renderer and canvas */
const container = document.body;
const renderer = new WebGLRenderer({antialias: true, alpha: true});
// renderer.setClearColor(0x48e2dd); // use styles on
container.style.overflow = 'hidden';
container.style.margin = 0;
container.appendChild(renderer.domElement);

/* Composer for special effects */
const composer = new WAGNER.Composer(renderer);
const bloomPass = new BloomPass();
const fxaaPass = new FXAAPass();
const noise = new Noise({
	amount : .1,
	speed : .1
});
const vignette = new VignettePass({
	boost : 1,
	reduction : 1
});
const dof = new DOFPass({
	focalDistance : .0001,
	aperture : .1,
	tBias : .1,
	blurAmount : .1
});

/* Main scene and camera */
const scene = new Scene();
const camera = new PerspectiveCamera(50, resize.width / resize.height, 0.1, 1000);
const controls = new OrbitControls(camera, {
	element: renderer.domElement, 
	distance: 200,
	phi: Math.PI * 0.5,
	distanceBounds: [0, 300]
});

/* Lights */
var light = new AmbientLight( 0x404040 ); // soft white light
scene.add( light );
scene.fog = new Fog( 0xff7dff, 500, 10000 );

/* Various event listeners */
resize.addListener(onResize);


/* create and launch main loop */
const engine = loop(render);
engine.start();

/* some stuff with gui */
gui.add(SETTINGS, 'useComposer');
gui.add(SETTINGS, 'focalDistance');

/* custom variables */
var t = 0,
tprev = t;

/* -------------------------------------------------------------------------------- */

/**
  Resize canvas
*/
function onResize() {
	camera.aspect = resize.width / resize.height;
	camera.updateProjectionMatrix();
	renderer.setSize(resize.width, resize.height);
	composer.setSize(resize.width, resize.height);
}

//// cloth bs

// Drape - a fabric simulation software
// Built using three.js starting from the simple cloth simulation
// http://threejs.org/examples/#webgl_animation_cloth

var guiEnabled = true;

var structuralSprings = true;
var shearSprings = false;
var bendingSprings = true;

var DAMPING = 0.03;
var DRAG = 1 - DAMPING;
var MASS = .1;

var restDistanceB = 2;
var restDistanceS = Math.sqrt(2);

var friction = 0.9; // similar to coefficient of friction. 0 = frictionless, 1 = cloth sticks in place

var xSegs = 30; // how many particles wide is the cloth
var ySegs = 30; // how many particles tall is the cloth

var fabricLength = 500; // sets the size of the cloth
var restDistance; // = fabricLength/xSegs;

var wind = false;
var windStrength, 
	  ballPositionMultiplier = 12,
    lockMod = 15;
var windForce = new Vector3(0, 0, 0);

var rotate = false;
var pinned = 'Corners';
var thing = 'Ball';

var cornersPinned, oneEdgePinned, twoEdgesPinned, fourEdgesPinned, randomEdgesPinned;

var avoidClothSelfIntersection = false;
var loader = new TextureLoader();

var clothInitialPosition = plane(500, 500);
var cloth = new Cloth(xSegs, ySegs, fabricLength);

var GRAVITY = 9.81 * 140; //
var gravity = new Vector3(0, -GRAVITY, 0).multiplyScalar(MASS);


var TIMESTEP = 18 / 1000;
var TIMESTEP_SQ = TIMESTEP * TIMESTEP;

var ballSize = 500 / 4; //40
var ballPosition = new Vector3(0, -250 + ballSize, 0);
var prevBallPosition = new Vector3(0, -250 + ballSize, 0);

var tmpForce = new Vector3();

var lastTime;

var pos;

var whereAmI, whereWasI;
var posFriction = new Vector3(0, 0, 0);
var posNoFriction = new Vector3(0, 0, 0);

var diff = new Vector3();
var objectCenter = new Vector3();

var a, b, c, d, e, f;

var nearestX, nearestY, nearestZ;
var currentX, currentY, currentZ;
var xDist, yDist, zDist;
var randomPoints = [];
var rand, randX, randY;

function pinCloth(choice) {
    if (choice == 'Corners') {
        cornersPinned = true;
        oneEdgePinned = false;
        twoEdgesPinned = false;
        fourEdgesPinned = false;
        randomEdgesPinned = false;
    } else if (choice == 'OneEdge') {
        cornersPinned = false;
        oneEdgePinned = true;
        twoEdgesPinned = false;
        fourEdgesPinned = false;
        randomEdgesPinned = false;
    } else if (choice == 'TwoEdges') {
        cornersPinned = false;
        oneEdgePinned = false;
        twoEdgesPinned = true;
        fourEdgesPinned = false;
        randomEdgesPinned = false;
    } else if (choice == 'FourEdges') {
        cornersPinned = false;
        oneEdgePinned = false;
        twoEdgesPinned = false;
        fourEdgesPinned = true;
        randomEdgesPinned = false;
    } else if (choice == 'Random') {
        cornersPinned = false;
        oneEdgePinned = false;
        twoEdgesPinned = false;
        fourEdgesPinned = false;
        randomEdgesPinned = true;

        rand = Math.round(Math.random() * 10) + 1;
        randomPoints = [];
        for (u = 0; u < rand; u++) {
            randX = Math.round(Math.random() * xSegs);
            randY = Math.round(Math.random() * ySegs);
            randomPoints.push([randX, randY]);
        }
    } else if (choice == 'None') {
        cornersPinned = false;
        oneEdgePinned = false;
        twoEdgesPinned = false;
        fourEdgesPinned = false;
        randomEdgesPinned = false;
    }
}

function createThing(thing) {
    if (thing == 'Ball' || thing == 'ball') {
        sphere.visible = true;
        restartCloth();
    } else if (thing == 'None' || thing == 'none') {
        sphere.visible = false;
    }
}

function plane(width, height) {
    return function(u, v) {
        var x = u * width - width / 2;
        var y = 125; //height/2;
        var z = v * height - height / 2;

        return new Vector3(x, y, z);
    };
}

function Particle(x, y, z, mass) {
    this.position = clothInitialPosition(x, y); // position
    this.previous = clothInitialPosition(x, y); // previous
    this.original = clothInitialPosition(x, y); // original
    this.a = new Vector3(0, 0, 0); // acceleration
    this.mass = mass;
    this.invMass = 1 / mass;
    this.tmp = new Vector3();
    this.tmp2 = new Vector3();
}

Particle.prototype.lockToOriginal = function() {
    this.position.copy(this.original);
    this.previous.copy(this.original);
}

Particle.prototype.lock = function() {
    this.position.copy(this.previous);
    this.previous.copy(this.previous);

}


// Force -> Acceleration
Particle.prototype.addForce = function(force) {
    this.a.add(
        this.tmp2.copy(force).multiplyScalar(this.invMass)
    );
};

// Performs verlet integration
Particle.prototype.integrate = function(timesq) {
    var newPos = this.tmp.subVectors(this.position, this.previous);
    newPos.multiplyScalar(DRAG).add(this.position);
    newPos.add(this.a.multiplyScalar(timesq));

    this.tmp = this.previous;
    this.previous = this.position;
    this.position = newPos;

    this.a.set(0, 0, 0);
};

function satisifyConstrains(p1, p2, distance) {
    diff.subVectors(p2.position, p1.position);
    var currentDist = diff.length();
    if (currentDist == 0) return; // prevents division by 0
    var correction = diff.multiplyScalar((currentDist - distance) / currentDist);
    var correctionHalf = correction.multiplyScalar(0.5);
    p1.position.add(correctionHalf);
    p2.position.sub(correctionHalf);
}

function repelParticles(p1, p2, distance) {
    diff.subVectors(p2.position, p1.position);
    var currentDist = diff.length();
    if (currentDist == 0) return; // prevents division by 0
    if (currentDist < distance) {
        var correction = diff.multiplyScalar((currentDist - distance) / currentDist);
        var correctionHalf = correction.multiplyScalar(0.5);
        p1.position.add(correctionHalf);
        p2.position.sub(correctionHalf);
    }
}

    
    var u, v;

function Cloth(w, h, l) {
    this.w = w;
    this.h = h;
    restDistance = l / w; // assuming square cloth for now

    var particles = [];
    var constrains = [];

    // Create particles
    for (v = 0; v <= h; v++) {
        for (u = 0; u <= w; u++) {
            particles.push(
                new Particle(u / w, v / h, 0, MASS)
            );
        }
    }

    // create constrains i think
    for (v = 0; v <= h; v++) {
        for (u = 0; u <= w; u++) {

            if (v < h && (u == 0 || u == w)) {
                constrains.push([
                    particles[index(u, v)],
                    particles[index(u, v + 1)],
                    restDistance
                ]);
            }

            if (u < w && (v == 0 || v == h)) {
                constrains.push([
                    particles[index(u, v)],
                    particles[index(u + 1, v)],
                    restDistance
                ]);
            }
        }
    }

    // Structural
    if (structuralSprings) {
        for (v = 0; v < h; v++) {
            for (u = 0; u < w; u++) {

                if (u != 0) {
                    constrains.push([
                        particles[index(u, v)],
                        particles[index(u, v + 1)],
                        restDistance
                    ]);
                }

                if (v != 0) {
                    constrains.push([
                        particles[index(u, v)],
                        particles[index(u + 1, v)],
                        restDistance
                    ]);
                }

            }
        }
    }

    // Shear

    if (shearSprings) {
        for (v = 0; v <= h; v++) {
            for (u = 0; u <= w; u++) {

                if (v < h && u < w) {
                    constrains.push([
                        particles[index(u, v)],
                        particles[index(u + 1, v + 1)],
                        restDistanceS * restDistance
                    ]);

                    constrains.push([
                        particles[index(u + 1, v)],
                        particles[index(u, v + 1)],
                        restDistanceS * restDistance
                    ]);
                }

            }
        }
    }

    // Bending springs
    if (bendingSprings) {
        for (v = 0; v < h; v++) {
            for (u = 0; u < w; u++) {
                if (v < h - 1) {
                    constrains.push([
                        particles[index(u, v)],
                        particles[index(u, v + 2)],
                        restDistanceB * restDistance
                    ]);
                }

                if (u < w - 1) {
                    constrains.push([
                        particles[index(u, v)],
                        particles[index(u + 2, v)],
                        restDistanceB * restDistance
                    ]);
                }
            }
        }
    }

    this.particles = particles;
    this.constrains = constrains;

    function index(u, v) {
        return u + v * (w + 1);
    }

    this.index = index;
}

function map(n, start1, stop1, start2, stop2) {
    return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
}

export function simulate(time, rotX) {
    if (!lastTime) {
        lastTime = time;
        return;
    }

    var i, il, particles, particle, pt, constrains, constrain;

    // Aerodynamics forces
    if (wind) {
        windStrength = Math.cos(time / 7000) * 20 + 40;
        windForce.set(
            Math.sin(time / 2000 ),
            Math.cos(time / 3000 ),
            Math.sin(time / 1000 )
        ).normalize().multiplyScalar(windStrength);

        // apply the wind force to the cloth particles
        var face, faces = clothGeometry.faces, normal;
        particles = cloth.particles;
        for (i = 0, il = faces.length; i < il; i++) {
            face = faces[i];
            normal = face.normal;
            tmpForce.copy(normal).normalize().multiplyScalar(normal.dot(windForce));
            particles[face.a].addForce(tmpForce);
            particles[face.b].addForce(tmpForce);
            particles[face.c].addForce(tmpForce);
        }
    }

    for (particles = cloth.particles, i = 0, il = particles.length; i < il; i++) {
        particle = particles[i];
        particle.addForce(gravity);
        particle.integrate(TIMESTEP_SQ); // performs verlet integration
    }

    // Start Constrains
    constrains = cloth.constrains,
    		il = constrains.length;
    for (i = 0; i < il; i++) {
        constrain = constrains[i];
        satisifyConstrains(constrain[0], constrain[1], constrain[2], constrain[3]);
    }

    prevBallPosition.copy(ballPosition);
    ballPosition.y = ballPositionMultiplier * Math.sin(Date.now() / 600);
    ballPosition.x = ballPositionMultiplier * Math.sin(Date.now() / 600);
    ballPosition.z = ballPositionMultiplier * Math.cos(Date.now() / 600);

    if (avoidClothSelfIntersection) {
        for (i = 0; i < particles.length; i++) {
            p_i = particles[i];
            for (j = 0; j < particles.length; j++) {
                p_j = particles[j];
                repelParticles(p_i, p_j, restDistance);
            }
        }
    }

    for (particles = cloth.particles, i = 0, il = particles.length; i < il; i++) {

        particle = particles[i];
        whereAmI = particle.position;
        whereWasI = particle.previous;

        // check to see if point is inside sphere
        if (sphere.visible) {

            diff.subVectors(whereAmI, ballPosition);
            if (diff.length() < ballSize) {
                // if yes, we've collided, so take correcting action

                // no friction behavior:
                // project point out to nearest point on sphere surface
                diff.normalize().multiplyScalar(ballSize);
                posNoFriction.copy(ballPosition).add(diff);

                diff.subVectors(whereWasI, ballPosition);

                if (diff.length() > ballSize) {
                    // with friction behavior:
                    // add the distance that the sphere moved in the last frame
                    // to the previous position of the particle
                    diff.subVectors(ballPosition, prevBallPosition);
                    posFriction.copy(whereWasI).add(diff);

                    posNoFriction.multiplyScalar(1 - friction);
                    posFriction.multiplyScalar(friction);
                    whereAmI.copy(posFriction.add(posNoFriction));
                } else {
                    whereAmI.copy(posNoFriction);
                }
            }
        }
    }

    // Floor Constains
    for (particles = cloth.particles, i = 0, il = particles.length; i < il; i++) {
        particle = particles[i];
        pos = particle.position;
        if (pos.y < -249) { pos.y = -249; }
    }

    // Pin Constrains
    if (cornersPinned) {
        // could also do particles[blah].lock() which will lock particles to wherever they are, not to their original position
        particles[cloth.index(lockMod, lockMod)].lockToOriginal();
        particles[cloth.index(xSegs+lockMod, lockMod)].lockToOriginal();
        particles[cloth.index(lockMod, ySegs-lockMod)].lockToOriginal();
        particles[cloth.index(xSegs+lockMod, ySegs-lockMod)].lockToOriginal();
    } else if (oneEdgePinned) {
        for (u = 0; u <= xSegs; u++) {
            particles[cloth.index(u, 0)].lockToOriginal();
        }
    } else if (twoEdgesPinned) {
        for (u = 0; u <= xSegs; u++) {
            particles[cloth.index(0, u)].lockToOriginal();
            particles[cloth.index(xSegs, u)].lockToOriginal();
        }
    } else if (fourEdgesPinned) {
        for (u = 0; u <= xSegs; u++) {
            particles[cloth.index(0, u)].lockToOriginal();
            particles[cloth.index(xSegs, u)].lockToOriginal();
            particles[cloth.index(u, 0)].lockToOriginal();
            particles[cloth.index(u, xSegs)].lockToOriginal();
        }
    } else if (randomEdgesPinned) {
        for (u = 0; u < randomPoints.length; u++) {
            rand = randomPoints[u];
            randX = rand[0];
            randY = rand[1];
            particles[cloth.index(randX, randY)].lockToOriginal();
        }
    }

}



///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////

var clothGeometry;
var groundMaterial;

var sphere;
var clothObject;
var collidableMeshList = [];

var guiControls;

var poleMat, clothMaterial, ballMaterial;


if(guiEnabled){

  // GUI controls
  //sliders

  guiControls = new function(){
    this.friction = friction;
    this.particles = xSegs;
    this.rotate = rotate;

    this.wind = wind;
    this.ballPositionMultiplier = ballPositionMultiplier;
    this.lockMod = lockMod;
    this.thing = thing;
    this.pinned = pinned;

    this.avoidClothSelfIntersection = avoidClothSelfIntersection;

    this.fabricLength = fabricLength;
    this.structuralSprings = structuralSprings;

    this.bendingSprings = bendingSprings;
    this.bendingSpringLengthMultiplier = restDistanceB;

    this.shearSprings = shearSprings;
    this.shearSpringLengthMultiplier = restDistanceS;

    this.clothColor = 0xaa2929;
    this.clothSpecular = 0xfffe75;

    this.groundColor = 0xf53e69;
    this.groundSpecular = 0x404761;

    this.fogColor = 0xff7dff;

  };

  let gui2 = new datgui.GUI();

  var f0 = gui2.add(guiControls, 'fabricLength', 200, 1000)
  	.step(20)
  	.name('Size')
  	.onChange(function(value){
  		fabricLength = value; 
  		xSegs = Math.round(value/20); 
  		ySegs = Math.round(value/20); 
  		restartCloth();
  	});
  var f1 = gui2.add(guiControls, 'ballPositionMultiplier', 1, 20)
  	.step(1)
  	.name('ballPositionMultiplier')
  	.onChange(function(value) {
  		if (value < 1) value = 1;
  		ballPositionMultiplier = value;
  	});
  var f1 = gui2.add(guiControls, 'lockMod', 1, 20)
      .step(1)
      .name('lockMod')
      .onChange(function(value) {
          if (value < 1) value = 1;
          lockMod = value;
      });
    
  var f4 = gui2.addFolder('Interaction')

  // f4.add(guiControls, 'rotate').name('auto rotate').onChange(function(value){rotate = value;});
  f4.add(guiControls, 'wind').name('wind').onChange(function(value){
  	wind = false;
  });

  f4.add(guiControls, 'thing', ['None', 'Ball']).name('clothObject').onChange(function(value){
  	createThing(value);}
  );
  f4.add(guiControls, 'pinned', ['None', 'Corners', 'OneEdge', 'TwoEdges','FourEdges', 'randomEdgesPinned']).name('pinned')
  	.onChange(function(value){
  		pinCloth(value);
  		restartCloth();
  	});

  var f2 = gui2.addFolder('Behavior');

  f2.add(guiControls, 'structuralSprings').name('cross grain').onChange(function(value){structuralSprings = value; restartCloth();});
  f2.add(guiControls, 'shearSprings').name('bias grain').onChange(function(value){shearSprings = value; restartCloth();});
  f2.add(guiControls, 'bendingSprings').name('drape').onChange(function(value){bendingSprings = value; restartCloth();});
  f2.add(guiControls, 'friction', 0, 1).onChange(function(value){friction = value;});
  // f2.add(guiControls, 'avoidClothSelfIntersection').name('NoSelfIntersect').onChange(function(value){avoidClothSelfIntersection = value;});
  // f2.add(guiControls, 'weight', 0, 500).step(1).onChange(function(value){weight = value; restartCloth();});

  var f3 = gui2.addFolder('Appearance');
  f3.addColor(guiControls, 'clothColor').name('cloth color').onChange(function(value){clothMaterial.color.setHex(value);});
  f3.addColor(guiControls, 'clothSpecular').name('cloth reflection').onChange(function(value){clothMaterial.specular.setHex(value);});
  f3.addColor(guiControls, 'groundColor').name('ground color').onChange(function(value){groundMaterial.color.setHex(value);});
  f3.addColor(guiControls, 'groundSpecular').name('gnd reflection').onChange(function(value){groundMaterial.specular.setHex(value);});
  f3.addColor(guiControls, 'fogColor').onChange(function(value){scene.fog.color.setHex(value); renderer.setClearColor(scene.fog.color);});

}

function restartCloth() {
	scene.remove(clothObject);
	cloth = new Cloth( xSegs, ySegs, fabricLength );

	//GRAVITY = 9.81 * 140; //
	gravity = new Vector3( 0, - GRAVITY, 0 ).multiplyScalar( MASS );

	// recreate cloth geometry
	clothGeometry = new ParametricGeometry( clothInitialPosition, xSegs, ySegs );
	clothGeometry.dynamic = true;
	
	// recreate cloth mesh
	clothObject = new Mesh( clothGeometry, clothMaterial );
	clothObject.position.set( 0, 0, 0 );
	clothObject.castShadow = true;

	scene.add( clothObject ); // adds the cloth to the scene
}

// cloth material
// this tells us the material's color, how light reflects off it, etc.

var clothTexture = loader.load( 'textures/patterns/circuit_pattern2.png' );
clothTexture.wrapS = clothTexture.wrapT = RepeatWrapping;
clothTexture.anisotropy = 16;

var clothMaterial = new MeshPhongMaterial( {
	color: 0xe35fb5,
	specular: 0xfffe75,
	wireframeLinewidth: 2,
	map: clothTexture,
	side: DoubleSide,
	alphaTest: 0.5
});



var clothInitialPosition = plane(500, 500);

// cloth geometry
// the geometry contains all the points and faces of an clothObject
clothGeometry = new ParametricGeometry( clothInitialPosition, cloth.w, cloth.h );
clothGeometry.dynamic = true;

/*// more stuff needed for the texture*/
var uniforms = { texture:  { type: "t", value: clothTexture } };
var vertexShader = document.getElementById( 'vertexShaderDepth' ).textContent;
var fragmentShader = document.getElementById( 'fragmentShaderDepth' ).textContent;


// cloth mesh
// a mesh takes the geometry and applies a material to it
// so a mesh = geometry + material
var clothObject = new Mesh( clothGeometry, clothMaterial );
clothObject.position.set( 0, 0, 0 );
clothObject.castShadow = true;
scene.add( clothObject );

// sphere
// sphere geometry
var ballGeo = new SphereGeometry( ballSize, 20, 20 );
var ballMaterial = new MeshPhongMaterial( {
	color: 0xaaaaaa,
	side: DoubleSide,
	// wireframe: true//,
	// transparent: true,
	// opacity:0.01
} );

var sphere = new Mesh( ballGeo, ballMaterial );
sphere.castShadow = true;
sphere.receiveShadow = true;
scene.add( sphere ); // add sphere to scene

// ground
/*// needed for ground texture*/
var groundTexture = loader.load( 'textures/terrain/grasslight-big.jpg' );
groundTexture.wrapS = groundTexture.wrapT = RepeatWrapping;
groundTexture.repeat.set( 25, 25 );
groundTexture.anisotropy = 16;

// ground material
var groundMaterial = new MeshPhongMaterial({
		color: 0xf53e69,
		specular: 0x404761//,
		//map: groundTexture
	});

// ground mesh
var  mesh = new Mesh( new PlaneBufferGeometry( 20000, 20000 ), groundMaterial );
mesh.position.y = -250;
mesh.rotation.x = - Math.PI / 2;
mesh.receiveShadow = true;
scene.add( mesh ); // add ground to scene

// createThing is a function that creates objects the cloth can collide into
createThing('Ball');
// pinCloth sets how the cloth is pinned
pinCloth('Corners');


/**
  Render loop
*/
function render(dt) {
	controls.update();
	//update frequencies
	var freqs = audioUtil.frequencies();

	// update average of bands
	var subAvg = average(analyser, freqs, bands.sub.from, bands.sub.to);
	var lowAvg = average(analyser, freqs, bands.low.from, bands.low.to);
	var midAvg = average(analyser, freqs, bands.mid.from, bands.mid.to);
	var highAvg = average(analyser, freqs, bands.high.from, bands.high.to);
	// console.log(subAvg, lowAvg, midAvg, highAvg);
	
	/* sphere rotation */
	tprev = t * .75;
	t = .0025 + lowAvg + tprev;
	var rotX = Math.sin(Math.PI * 10) + t;
	sphere.rotation.x = rotX;
	sphere.rotation.y = Math.cos(Math.PI * 7.5) + t;
	sphere.rotation.z += .005;

  sphere.position.x += rotX*ballPositionMultiplier;
  sphere.position.z += mathMap(lowAvg , 0, 1, 2, 15);

	var time = Date.now();
	simulate(time, rotX); // run physics simulation to create new positions of cloth

	// update position of the cloth
	// i.e. copy positions from the particles (i.e. result of physics simulation)
	// to the cloth geometry
	var p = cloth.particles;
	for ( var i = 0, il = p.length; i < il; i ++ ) {
		clothGeometry.vertices[i].copy( p[i].position );
	}

	clothGeometry.computeFaceNormals();
	clothGeometry.computeVertexNormals();
	clothGeometry.normalsNeedUpdate = true;
	clothGeometry.verticesNeedUpdate = true;

	sphere.position.copy( ballPosition );
	

	/* camera */
	camera.lookAt(sphere.position);
	camera.setFocalLength ( SETTINGS.focalDistance );
	camera.setFocalLength ( mathMap(lowAvg , 0, 1, 2, 6) );

	// edit composer with sound
	var ns = mathMap(highAvg,0, 1, .5, .75);
	noise.speed = ns;

	var fd = mathMap(lowAvg, 0, 1, .0001, 1);
	dof.focalDistance = fd;

	if (SETTINGS.useComposer) {
		composer.reset();
		composer.render(scene, camera);
		composer.pass(bloomPass);
		composer.pass(fxaaPass);
		composer.pass(noise);
		composer.pass(vignette);
		composer.pass(dof);
		composer.toScreen();
	}
	else {
		renderer.render(scene, camera);
		renderer.gammaInput = true;
		renderer.gammaOutput = true;
		renderer.shadowMap.enabled = true;
	}
}