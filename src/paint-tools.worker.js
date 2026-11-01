import {bulkPaintTargets} from './paint-tools.js';
self.onmessage=({data})=>{try{self.postMessage({ids:bulkPaintTargets(data.blocks,data.seedId,data.tool,data.rule)});}catch(error){self.postMessage({error:error.message});}};
