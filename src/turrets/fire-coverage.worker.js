import {computeShipCoverage} from './fire-coverage.js';
self.onmessage=event=>{try{self.postMessage({result:computeShipCoverage(event.data,(done,total)=>self.postMessage({progress:{done,total}}))});}catch(error){self.postMessage({error:error.message});}};
