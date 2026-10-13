/** Supplied FIS certificate 105 / POL 1: HS140_2022.pdf.
 * Metres, degrees, m/s. Preserve reported fields rather than silently correcting
 * inconsistent rounding or treating a certificate as a complete survey. */
export const certificate = {
  number: '105 / POL 1', name: 'Wielka Krokiew', place: 'Zakopane',
  issued: '2022-12-09', validUntil: '2028-04-30',
  hs: 140, p: 109, k: 125, l: 140, nominalSpeed: 28.28, reportedHeightRatio: .575,
  inrun: {
    e1: 97.80, e2: 77.00, es: 20.80, gates: 34, reportedGatePitch: .68,
    gateTread: .36, gateWidth: .50, tableLength: 6.50,
    angle: 35, tableAngle: 11, radius: 90, width: 2.65,
  },
  landing: {
    h: 62.37, n: 107.76, tableHeight: 3.13,
    pToK: 16, kToL: 15, pAngle: 37, kAngle: 34.30, lAngle: 31.30,
    radius: 310, transitionRadiusAtL: 168, transitionRadiusAtU: 99.30,
    uDrop: 89.11, kWidth: 25, uWidth: 27.50,
  },
  outrun: { horizontalLength: 103, uphillAngle: 17 },
  judges: { x: 84, lateralOffset: 35 },
} as const;

/** Beta at S and b2 are omitted from the certificate. */
export const reconstruction = { knollStartAngle: 6, knollStartWidth: 8 } as const;
