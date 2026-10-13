/** Equipment dimensions use metres, masses kilograms and angles radians.
 * Longitudinal positions increase from the ski tail (0) towards its tip (L).
 * Mount offsets are measured from the boot TOE, never from the ankle. */
export interface EquipmentConfig {
  ski: {
    lengthM: number; widthM: number; thicknessM: number;
    tipRiseM: number; tailRiseM: number; massKg: number;
    massDistribution: { startFraction: number; endFraction: number; massFraction: number }[];
    centerOfPressureFraction: number;
    minTailGapM: number; vAngleRad: number;
  };
  binding: {
    frontSkiFraction: number; bootToePositionM: number;
    frontAttachmentOffsetM: number; rearAttachmentOffsetM: number;
    ankleOffsetM: number; ankleHeightM: number; bootLengthM: number;
    bootSoleHeightM: number; frontPivotHeightM: number;
    rearSkiAnchorOffsetM: number; rearSkiAnchorHeightM: number;
    rearBootAttachmentHeightM: number; rearGuideLateralOffsetM: number; rodMaxLengthM: number;
    angularStiffnessNmPerRad: number; bootSoleAngularStiffnessNmPerRad: number;
    dampingNmsPerRad: number; maxActuatorTorqueNm: number;
  };
}

function freeze<T>(value:T):T {
  if(value && typeof value==='object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Geometry and engineering starting values, not measured equipment data.
 * The requested 57% mounting rule is supplied by the user. See EQUIPMENT.md. */
export const DEFAULT_EQUIPMENT:EquipmentConfig = freeze({
  ski: {
    lengthM:2.6, widthM:.115, thicknessM:.021, tipRiseM:.105, tailRiseM:.012,
    massKg:2.2,
    massDistribution:[
      {startFraction:0,endFraction:.35,massFraction:.31},
      {startFraction:.35,endFraction:.65,massFraction:.42},
      {startFraction:.65,endFraction:1,massFraction:.27},
    ],
    centerOfPressureFraction:.46, minTailGapM:.03, vAngleRad:.25,
  },
  binding: {
    frontSkiFraction:.57, bootToePositionM:2.6*(1-.57),
    frontAttachmentOffsetM:-.025, rearAttachmentOffsetM:-.285,
    ankleOffsetM:-.18, ankleHeightM:.115, bootLengthM:.31, bootSoleHeightM:.034,
    frontPivotHeightM:.025, rearSkiAnchorOffsetM:-.305,
    rearSkiAnchorHeightM:.028, rearBootAttachmentHeightM:.042, rearGuideLateralOffsetM:.056,
    rodMaxLengthM:.075, angularStiffnessNmPerRad:180,
    bootSoleAngularStiffnessNmPerRad:180, dampingNmsPerRad:5,
    maxActuatorTorqueNm:8,
  },
});

export function cloneEquipmentConfig(config:EquipmentConfig=DEFAULT_EQUIPMENT):EquipmentConfig {
  return JSON.parse(JSON.stringify(config)) as EquipmentConfig;
}

/** Attempts receive their own validated immutable parameter snapshot. */
export function freezeEquipmentConfig(config:EquipmentConfig=DEFAULT_EQUIPMENT,options:{competition?:boolean}={}):EquipmentConfig {
  const validation=validateEquipmentConfig(config,options);
  if(!validation.valid)throw new Error(validation.errors.join(' '));
  return freeze(cloneEquipmentConfig(config));
}

export function setBindingFraction(config:EquipmentConfig,fraction:number):EquipmentConfig {
  const result=cloneEquipmentConfig(config);
  result.binding.frontSkiFraction=fraction;
  result.binding.bootToePositionM=result.ski.lengthM*(1-fraction);
  return result;
}

export interface EquipmentValidation { valid:boolean; errors:string[] }
export function validateEquipmentConfig(config:EquipmentConfig,options:{competition?:boolean}={}):EquipmentValidation {
  const errors:string[]=[];
  if(!config || !config.ski || !config.binding) return {valid:false,errors:['Missing ski or binding configuration.']};
  const s=config.ski,b=config.binding;
  const range=(name:string,value:number,min:number,max:number)=>{
    if(!Number.isFinite(value)||value<min||value>max)errors.push(`${name}: expected ${min}..${max} in the declared SI unit.`);
  };
  range('ski.lengthM',s.lengthM,1.8,3.2);range('ski.widthM',s.widthM,.07,.16);
  range('ski.thicknessM',s.thicknessM,.008,.035);range('ski.tipRiseM',s.tipRiseM,.02,.25);
  range('ski.tailRiseM',s.tailRiseM,0,.05);range('ski.massKg',s.massKg,.5,5);
  range('ski.centerOfPressureFraction',s.centerOfPressureFraction,.05,.95);
  range('ski.minTailGapM',s.minTailGapM,0,.2);range('ski.vAngleRad',s.vAngleRad,0,.5);
  range('binding.frontSkiFraction',b.frontSkiFraction,.4,.7);
  range('binding.bootToePositionM',b.bootToePositionM,0,s.lengthM);
  range('binding.frontAttachmentOffsetM',b.frontAttachmentOffsetM,-.08,0);
  range('binding.rearAttachmentOffsetM',b.rearAttachmentOffsetM,-.4,-.15);
  range('binding.ankleOffsetM',b.ankleOffsetM,-.28,-.1);
  range('binding.ankleHeightM',b.ankleHeightM,.08,.16);range('binding.bootLengthM',b.bootLengthM,.24,.4);
  range('binding.bootSoleHeightM',b.bootSoleHeightM,.02,.06);
  range('binding.frontPivotHeightM',b.frontPivotHeightM,.01,.07);
  range('binding.rearSkiAnchorOffsetM',b.rearSkiAnchorOffsetM,-.45,-.15);
  range('binding.rearSkiAnchorHeightM',b.rearSkiAnchorHeightM,.01,.09);
  range('binding.rearBootAttachmentHeightM',b.rearBootAttachmentHeightM,.02,.09);
  range('binding.rearGuideLateralOffsetM',b.rearGuideLateralOffsetM,0,.09);
  range('binding.rodMaxLengthM',b.rodMaxLengthM,.025,.2);
  range('binding.angularStiffnessNmPerRad',b.angularStiffnessNmPerRad,1,1000);
  range('binding.bootSoleAngularStiffnessNmPerRad',b.bootSoleAngularStiffnessNmPerRad,1,1000);
  range('binding.dampingNmsPerRad',b.dampingNmsPerRad,0,50);
  range('binding.maxActuatorTorqueNm',b.maxActuatorTorqueNm,0,50);
  if(Math.abs(b.bootToePositionM-s.lengthM*(1-b.frontSkiFraction))>1e-9)
    errors.push('binding.bootToePositionM and frontSkiFraction disagree: the measurement must end at the boot toe.');
  if(b.frontAttachmentOffsetM<=b.rearAttachmentOffsetM || b.ankleOffsetM<=b.rearAttachmentOffsetM || b.ankleOffsetM>=b.frontAttachmentOffsetM)
    errors.push('The ankle must lie between the front and rear attachment points.');
  if(b.rearAttachmentOffsetM < -b.bootLengthM || b.frontAttachmentOffsetM < -b.bootLengthM)
    errors.push('The boot attachment points must lie on the boot sole.');
  const neutralRod=Math.hypot(b.rearAttachmentOffsetM-b.rearSkiAnchorOffsetM,b.rearBootAttachmentHeightM-b.rearSkiAnchorHeightM);
  if(b.rodMaxLengthM<=neutralRod)errors.push('The rear rod must allow its neutral assembled length.');
  const rotatedRearAt90={x:b.frontAttachmentOffsetM+b.rearBootAttachmentHeightM-b.frontPivotHeightM,
    y:b.frontPivotHeightM-(b.rearAttachmentOffsetM-b.frontAttachmentOffsetM)};
  if(b.rodMaxLengthM>=Math.hypot(rotatedRearAt90.x-b.rearSkiAnchorOffsetM,rotatedRearAt90.y-b.rearSkiAnchorHeightM))
    errors.push('The rod must limit heel motion before a 90 degree rotation.');
  if(!Array.isArray(s.massDistribution)||s.massDistribution.length===0)errors.push('Missing ski mass distribution.');
  else {
    let end=0,total=0;
    for(const segment of s.massDistribution) {
      if(!segment || ![segment.startFraction,segment.endFraction,segment.massFraction].every(Number.isFinite)
        ||Math.abs(segment.startFraction-end)>1e-9||segment.endFraction<=segment.startFraction||segment.endFraction>1||segment.massFraction<=0) {
        errors.push('Ski mass segments must cover 0..1 continuously and have positive mass.');break;
      }
      end=segment.endFraction;total+=segment.massFraction;
    }
    if(Math.abs(end-1)>1e-9||Math.abs(total-1)>1e-9)errors.push('Ski mass coverage and mass fractions must each sum to one.');
  }
  // Conservatively reject nominal >57% even if a centimetre display rounds down.
  // Exact FIS rounding wording has not been independently verified.
  if(options.competition && b.frontSkiFraction>.57+1e-12)
    errors.push('Competition mounting: the nominal tip-to-boot-toe length must not exceed 57% of ski length.');
  return {valid:errors.length===0,errors};
}

export function assertCompetitionEquipment(config:EquipmentConfig):void {
  const result=validateEquipmentConfig(config,{competition:true});
  if(!result.valid)throw new Error(result.errors.join(' '));
}

export function mountingMeasurement(config:EquipmentConfig) {
  const frontLengthM=config.ski.lengthM-config.binding.bootToePositionM;
  return {frontLengthM,rearLengthM:config.binding.bootToePositionM,
    frontLengthRoundedCm:Math.round(frontLengthM*100),
    ankleFromTailM:config.binding.bootToePositionM+config.binding.ankleOffsetM,
    frontAttachmentFromTailM:config.binding.bootToePositionM+config.binding.frontAttachmentOffsetM};
}
