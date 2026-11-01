// The native Standard/BatteryCharge equations normalized by maxHeat/maxCharge.
// Unknown native restart hysteresis is an explicit calibration threshold.
export class FiringResource {
 constructor(config){this.config=config;this.debt=0;this.recovering=false;}
 advance(dt){if(!this.config)return;this.debt=Math.max(0,this.debt-dt/this.config.recoveryTime);if(this.recovering&&this.debt<=this.config.restartDebt)this.recovering=false;}
 consume(event){if(!this.config||!['shot','tick'].includes(event.type)||event.shot>0)return;this.debt=Math.min(1,this.debt+this.config.perEmission);if(this.debt>=1-1e-10)this.recovering=true;}
 get ready(){return !this.recovering;}
 get status(){return !this.config?'Native cooling default unresolved':`${this.config.mode==='charge'?'Charge':'Heat'} ${Math.round((this.config.mode==='charge'?1-this.debt:this.debt)*100)}%${this.recovering?' - recovering':''}`;}
}
