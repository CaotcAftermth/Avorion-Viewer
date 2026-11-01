import * as THREE from "../../../vendor/three.module.js";
import { resolvedSecondaryColor } from "../avorion/secondaryColor.js";
import { localScaleFor, resolveOrientation } from "../avorion/orientation.js";
import { thrusterPorts } from "./thrusterPorts.js";
import { createPortObstruction } from "./portObstruction.js";
import {secondaryColor} from '../../../block-colors.js';
// Effects are viewer state. The archive supplies the barrier formula. Engine
// plume lengths come from in-game observation (fixed per engine state, not
// scaled by engine size); thruster jets and emitter spacing remain defaults.
export const HANGAR_TRAVEL_SECONDS = .25;
export function effectColor(block) {
    if(block.typeIndex===3||block.typeIndex===10){
        const base=block.typeIndex===10?[.02,.42,1.0]:[.03,.42,1.0],raw=secondaryColor(block);
        const weight=/^[0-9a-f]{8}$/i.test(raw||'')?parseInt(raw.slice(0,2),16)/255:0;
        return new THREE.Color(...base.map((value,i)=>value*(1-weight)+(weight?parseInt(raw.slice(2+i*2,4+i*2),16)/255*weight:0)));
    }
    const [r, g, b] = resolvedSecondaryColor(block);
    return new THREE.Color(r, g, b);
}
// Observed light height: one unit plus 10% of the block's axial height above its face.
export function lightEmitterDistance(height) {
    return height * .5 + 1 + height * .1;
}
export function buildBlockEffects(blocks, profile, params) {
    const pos = [], root = [], uv = [], color = [], data = [], dir = [];
    const ranges = new Map();
    const obstruction = createPortObstruction(blocks, profile);
    const emitters = [];
    const append = (block, positions, coords, origin, kind, tint, axis = new THREE.Vector3(), seed = 0) => {
        const start = pos.length / 3;
        for (const i of [0, 1, 2, 0, 2, 3]) {
            pos.push(...positions[i].toArray());
            root.push(...origin.toArray());
            uv.push(...coords[i]);
            color.push(tint.r, tint.g, tint.b);
            dir.push(axis.x, axis.y, axis.z);
            data.push(kind, 1, (block.originalIndex ?? 0) % 17, seed); // preview blocks have no XML index
        }
        const list = ranges.get(block.id) ?? [];
        list.push([start, 6]);
        ranges.set(block.id, list);
    };
    const coords = [[-1, 0], [1, 0], [1, 1], [-1, 1]];
    for (const b of blocks) {
        if (![3, 7, 10, 13, 61, 62, 63, 64, 65].includes(b.typeIndex))
            continue;
        const { quaternion, base } = resolveOrientation(profile, b.look, b.up, b.typeIndex);
        const size = localScaleFor(base, b.size);
        const center = new THREE.Vector3(b.position.x, b.position.y, b.position.z);
        const world = (v) => v.applyQuaternion(quaternion).add(center);
        if (b.typeIndex === 10) {
            const x = size.x * .5 - Math.min(size.x * .15, .3), y = size.y * .5 - Math.min(size.y * .15, .3);
            for(const sign of [-1,1]){
                const z=sign*size.z*.48,origin=world(new THREE.Vector3(0,0,z));
                append(b, [[-x, -y], [x, -y], [x, y], [-x, y]].map(([u, v]) => world(new THREE.Vector3(u, v, z))), coords, origin, 3, effectColor(b));
            }
        }
        else if (b.typeIndex >= 61) {
            const origin = world(new THREE.Vector3(0, lightEmitterDistance(size.y), 0));
            const tint = effectColor(b);
            // Camera-facing sprite offsets; physical size is independent of block size.
            append(b, [[-.6, -.6], [.6, -.6], [.6, .6], [-.6, .6]].map(([x, y]) => new THREE.Vector3(x, y, 0)), coords, origin, b.typeIndex === 61 ? 4 : b.typeIndex === 62 ? 5 : b.typeIndex - 57, tint);
        }
        else {
            const sides = b.typeIndex === 3 ? [4] : b.typeIndex === 13 ? [4, 5] : [0, 1, 2, 3, 4, 5];
            for (const side of sides) {
                const axis = Math.floor(side / 2), sign = side % 2 ? 1 : -1;
                const direction = new THREE.Vector3().setComponent(axis, sign);
                const u = new THREE.Vector3().setComponent((axis + 1) % 3, 1);
                const v = new THREE.Vector3().crossVectors(direction, u);
                const faceWidth = size.getComponent((axis + 1) % 3), faceHeight = size.getComponent((axis + 2) % 3);
                const engine = b.typeIndex === 3;
                const ports = engine ? [{ x: 0, y: 0, radius: 0 }] : thrusterPorts(faceWidth, faceHeight);
                for (const port of ports) {
                    const surface = direction.clone().multiplyScalar(size.getComponent(axis) * .5).addScaledVector(u, port.x).addScaledVector(v, port.y);
                    const worldDirection = direction.clone().applyQuaternion(quaternion);
                    // In game, blocks covering an engine do not hide its plume.
                    const blockedBy = engine ? [] : obstruction(b.id, world(surface.clone()), worldDirection);
                    const origin = surface.addScaledVector(direction, Math.min(faceWidth, faceHeight) * .0001);
                    const widthU = engine ? faceWidth * .50 : Math.min(port.radius, faceWidth * .48);
                    const widthV = engine ? faceHeight * .50 : Math.min(port.radius, faceHeight * .48);
                    // Engine plumes are built one unit long and stretched in the shader to the
                    // engine state's length. Thruster reach follows the port size.
                    const length = engine ? 1 : Math.max(.1, port.radius * 5);
                    const start = pos.length / 3;
                    for (let plane = 0; plane < 3; plane++) {
                        const transverse = u.clone().multiplyScalar(Math.cos(plane * Math.PI / 3) * widthU).addScaledVector(v, Math.sin(plane * Math.PI / 3) * widthV);
                        const points = [origin.clone().sub(transverse), origin.clone().add(transverse),
                            origin.clone().addScaledVector(direction, length).addScaledVector(transverse, engine ? 1.25 : .1),
                            origin.clone().addScaledVector(direction, length).addScaledVector(transverse, engine ? -1.25 : -.1)];
                        append(b, points.map(world), coords, world(origin.clone()), engine ? 1 : 2, effectColor(b), worldDirection);
                    }
                    // Soft axial sections fill the rear view where longitudinal planes
                    // become edge-on. They share the same taper and nozzle dimensions.
                    if(engine)for(let slice=0;slice<8;slice++){
                        const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>world(origin.clone().addScaledVector(u,x*widthU*1.25).addScaledVector(v,y*widthV*1.25)));
                        append(b,points,coords,world(origin.clone()),10,effectColor(b),worldDirection,(slice+.5)/8);
                    }
                    if(engine)for(let particle=0;particle<16;particle++){
                        const angle=particle*2.399963229728653;
                        const radial=u.clone().multiplyScalar(Math.cos(angle)*widthU).addScaledVector(v,Math.sin(angle)*widthV);
                        const point=world(origin.clone().add(radial));
                        append(b,[point,point,point,point],coords,world(origin.clone()),9,effectColor(b),worldDirection,(particle+.5)/16);
                    }
                    emitters.push({ owner: b.id, start, count: pos.length / 3 - start, blockedBy });
                }
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute("aRoot", new THREE.Float32BufferAttribute(root, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(color, 3));
    geometry.setAttribute("aDir", new THREE.Float32BufferAttribute(dir, 3));
    const state = new THREE.Float32BufferAttribute(data, 4);
    state.setUsage(THREE.DynamicDrawUsage);
    const setHidden = (ids) => {
        for (const [id, list] of ranges)
            for (const [start, count] of list)
                for (let i = start; i < start + count; i++)
                    state.setY(i, ids.has(id) ? 0 : 1);
        for (const emitter of emitters)
            if (emitter.blockedBy.some(id => !ids.has(id)))
                for (let i = emitter.start; i < emitter.start + emitter.count; i++)
                    state.setY(i, 0);
        state.needsUpdate = true;
    };
    setHidden(new Set());
    geometry.setAttribute("aData", state);
    const material = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: { uBloomPass: { value: 0 }, uEngineState: { value: params.engineState??0 }, uTime: { value: 0 }, uThrust: { value: params.thrustPreview }, uPlume: { value: params.plumeLength ?? 0 }, uGlow: { value: params.glowStrength }, uBarrier: { value: params.barrierStrength },
            uGlassSplit: { value: 0 }, uGlassDepth: { value: null }, uGlassLogDepth: { value: 0 } },
        defines: { EFFECT_LAYER: 0 },
        vertexShader: `
      #include <common>
      uniform float uGlassSplit,uPlume,uTime,uEngineState;
      #include <logdepthbuf_pars_vertex>
      attribute vec3 aRoot; attribute vec3 aColor; attribute vec4 aData; attribute vec3 aDir;
      varying vec2 vUV; flat out vec3 vColor; flat out vec4 vData; varying float vFacing;
      void main(){vUV=uv;vColor=aColor;vData=aData;
        vec3 eyeAxis=normalize(mat3(modelViewMatrix)*aDir+vec3(0.0000001));
        vec3 eyeRoot=(modelViewMatrix*vec4(aRoot,1.0)).xyz;
        vec3 eyeRay=isPerspectiveMatrix(projectionMatrix)?normalize(-eyeRoot):vec3(0.0,0.0,1.0);
        vFacing=abs(dot(eyeAxis,eyeRay));
        #if EFFECT_LAYER == 1
        if(uGlassSplit<0.5){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}
        #endif
        vec3 local=position;
        if(aData.x==1.0)local+=aDir*(uPlume-1.0)*uv.y;
        vec4 p=modelViewMatrix*vec4(local,1.0);
        if(aData.x==10.0){
          float boost=step(1.5,uEngineState),t=aData.w;
          float envelope=sqrt(max(.0,1.0-smoothstep(.18,.99,t)));
          float width=mix(.76,1.0,boost)*envelope;
          local=aRoot+(position-aRoot)*width+aDir*(t*uPlume);
          p=modelViewMatrix*vec4(local,1.0);
        }
        else if(aData.x==9.0){
          float boost=step(1.5,uEngineState);
          float phase=fract(uTime*mix(.65,1.15,boost)+aData.w+aData.z*.031);
          vec3 radial=position-aRoot;
          vec3 center=aRoot+aDir*(phase*uPlume)+radial*(.08+mix(.3,.65,boost)*phase*phase);
          p=modelViewMatrix*vec4(center,1.0);
          float radius=max(.015,length(radial)*mix(.16,.28,boost))*(.55+phase);
          p.xy+=vec2(uv.x,uv.y*2.0-1.0)*radius;
        }
        else if(aData.x>=4.0) p=modelViewMatrix*vec4(aRoot,1.0)+vec4(position.xy,0.0,0.0);
        gl_Position=projectionMatrix*p;
        #include <logdepthbuf_vertex>
      }`,
        fragmentShader: `precision highp float; uniform float uTime,uThrust,uPlume,uGlow,uBarrier,uGlassSplit,uGlassLogDepth,uEngineState,uBloomPass;
      uniform highp sampler2D uGlassDepth;
      #include <logdepthbuf_pars_fragment>
      varying vec2 vUV; flat in vec3 vColor; flat in vec4 vData; varying float vFacing; out vec4 outColor;
      void main(){
        #include <logdepthbuf_fragment>
        // Layer 0 draws before translucent surfaces and layer 1 after them. With a
        // translucent depth map, effects behind glass are drawn first so glass
        // attenuates them; effects in front of glass are drawn last, unattenuated.
        if(uGlassSplit>0.5){
          float fragZ=gl_FragCoord.z;
          #ifdef USE_LOGDEPTHBUF
          if(uGlassLogDepth>0.5&&vIsPerspective!=0.0)fragZ=log2(vFragDepth)*logDepthBufFC*0.5;
          #endif
          bool behind=fragZ>texelFetch(uGlassDepth,ivec2(gl_FragCoord.xy),0).r;
          #if EFFECT_LAYER == 1
          if(behind)discard;
          #else
          if(!behind)discard;
          #endif
        }
        #ifdef BARRIER_ONLY
        if(vData.x!=3.0||uBloomPass>0.5)discard;
        #else
        if(vData.x==3.0)discard;
        #endif
        if(vData.y<0.5)discard;vec3 c=vColor;float a=0.0;
        if(vData.x==10.0){
          if(uPlume<=.001)discard;
          float boost=step(1.5,uEngineState),t=vData.w;
          vec2 q=vec2(vUV.x,vUV.y*2.0-1.0);float r=length(q);if(r>1.0)discard;
          float core=exp(-pow(r/.62,4.0)*2.0),halo=exp(-r*r*5.0)*(1.0-smoothstep(.8,1.0,r));
          a=(core*.13+halo*.035)*(1.0-smoothstep(.65,1.0,t))*vFacing*vFacing;
          c=mix(vColor,vec3(1.0),core*.88)*mix(2.0,2.6,boost);
        }else if(vData.x==9.0){
          if(uPlume<=.001)discard;
          float boost=step(1.5,uEngineState),phase=fract(uTime*mix(.65,1.15,boost)+vData.w+vData.z*.031);
          vec2 q=vec2(vUV.x,vUV.y*2.0-1.0);float r=dot(q,q);if(r>1.0)discard;
          a=exp(-r*4.0)*(1.0-smoothstep(.7,1.0,r))*sin(phase*3.14159265)*mix(.055,.10,boost);
          c=mix(vColor,vec3(1.0),.35)*mix(1.4,2.0,boost);
        }else if(vData.x==1.0){
          if(uPlume<=.001)discard;
          float boost=step(1.5,uEngineState),t=clamp(vUV.y,0.0,1.0),x=abs(vUV.x);
          float envelope=sqrt(max(.0,1.0-smoothstep(.18,.99,t)));
          float structure=.97+.03*sin(t*19.0-uTime*mix(7.0,11.0,boost)+vData.z);
          float coreWidth=max(.015,mix(.72,1.05,boost)*envelope*structure);
          float core=exp(-pow(x/coreWidth,4.0)*2.0);
          float haloWidth=max(.025,mix(.85,1.0,boost)*(.2+.8*envelope));
          float halo=exp(-pow(x/haloWidth,2.0)*4.0)*(1.0-smoothstep(.85,1.0,x));
          float tail=1.0-smoothstep(.65,1.0,t);
          float density=.90+.10*sin(t*27.0-uTime*mix(9.0,14.0,boost)+vData.z);
          a=(core*.32+halo*mix(.12,.22,boost))*tail*density*(1.0-.8*vFacing*vFacing);
          a*=(1.0-smoothstep(.72,1.0,x))*smoothstep(0.0,.035,t);
          c=mix(vColor,vec3(1.0),core*.88)*mix(2.0,2.6,boost);
        }else if(vData.x<3.0){float run=vData.x==1.0?step(0.001,uPlume):uThrust;if(run<=0.0)discard;
          float waves=vData.x==1.0?uPlume*6.0:24.0;
          // MSAA edge samples can extrapolate UVs outside the triangle. A negative
          // fractional-power base produces NaNs that spread through HDR bloom.
          float core=pow(max(0.0,1.0-abs(vUV.x)),2.0);float tip=pow(clamp(1.0-vUV.y,0.0,1.0),1.7);
          float pulse=0.88+0.12*sin(vUV.y*waves-uTime*12.0+vData.z);
          a=core*tip*pulse*run*.32;c=mix(vColor,vec3(1.0),core*tip*.6)*2.0;
        }else if(vData.x==3.0){
          // UV Y increases upward; adding time moves bands down four heights/s.
          float band=.5+.5*sin((vUV.y+uTime*${(1/HANGAR_TRAVEL_SECONDS).toFixed(1)})*6.28318530718*7.0);
          float edge=min(1.0-abs(vUV.x),2.0*min(vUV.y,1.0-vUV.y));
          float rim=1.0-smoothstep(.015,.16,edge);
          float core=1.0-smoothstep(.0,.045,edge);
          c=mix(vColor*(.78+.22*band),vec3(.15,.9,1.0),rim);
          c=mix(c,vec3(1.0),core);
          a=clamp(uBarrier*(.28+.12*band+rim*.6),0.0,1.0);
        }else{vec2 q=vec2(vUV.x,vUV.y*2.0-1.0);float r=length(q);if(r>1.0)discard;
          float flash=1.0;if(vData.x>=6.0){float period=vData.x==8.0?4.0:2.0;
            float onTime=vData.x==7.0?.5:1.0;flash=1.0-step(onTime,mod(uTime,period));}
          a=exp(-r*r*7.0)*flash;c=mix(c,vec3(1.0),exp(-r*r*80.0))*2.0;
        }outColor=vec4(c*(vData.x==3.0?1.0:uGlow),a);}`,
    });
    // Same geometry and uniforms, drawn on both sides of the translucent pass.
    const frontMaterial = material.clone();
    frontMaterial.uniforms = material.uniforms;
    frontMaterial.defines = { EFFECT_LAYER: 1 };
    const barrierMaterial=material.clone();barrierMaterial.uniforms=material.uniforms;
    barrierMaterial.defines={EFFECT_LAYER:0,BARRIER_ONLY:1};barrierMaterial.blending=THREE.NormalBlending;
    const barrierFrontMaterial=barrierMaterial.clone();barrierFrontMaterial.uniforms=material.uniforms;
    barrierFrontMaterial.defines={EFFECT_LAYER:1,BARRIER_ONLY:1};
    const meshes = [[material, 5, "block-effects"], [frontMaterial, 20, "block-effects-front"], ...(blocks.some(b=>b.typeIndex===10)?[[barrierMaterial, 5, "hangar-barrier"], [barrierFrontMaterial, 20, "hangar-barrier-front"]]:[])].map(([m, order, name]) => {
        const mesh = new THREE.Mesh(geometry, m);
        mesh.name = name;
        mesh.renderOrder = order;
        mesh.frustumCulled = false;
        mesh.userData.blockEffects = true;
        mesh.userData.hangarBarrier = !!m.defines.BARRIER_ONLY && blocks.some(b=>b.typeIndex===10);
        return mesh;
    });
    const mesh = meshes[0];
    return {
        mesh, meshes, ranges,
        updateColors(next) {
            const attribute = geometry.getAttribute("aColor");
            for (const b of next) {
                const list = ranges.get(b.id);
                if (!list)
                    continue;
                const tint = effectColor(b);
                for (const [start, count] of list){
                    attribute.addUpdateRange(start*3,count*3);
                    for (let i = start; i < start + count; i++)
                        attribute.setXYZ(i, tint.r, tint.g, tint.b);
                }
            }
            attribute.needsUpdate = true;
        },
        setTime(time) { material.uniforms.uTime.value = time; },
        setGlassDepth(texture, logDepth) { const u = material.uniforms; u.uGlassSplit.value = texture ? 1 : 0; u.uGlassDepth.value = texture; u.uGlassLogDepth.value = logDepth ? 1 : 0; },
        setParams(p) { material.uniforms.uEngineState.value=p.engineState??0; material.uniforms.uThrust.value = p.thrustPreview; material.uniforms.uPlume.value = p.plumeLength ?? 0; material.uniforms.uGlow.value = p.glowStrength; material.uniforms.uBarrier.value = p.barrierStrength; },
        setHidden,
        dispose() { geometry.dispose(); material.dispose(); frontMaterial.dispose(); barrierMaterial.dispose(); barrierFrontMaterial.dispose(); },
    };
}
