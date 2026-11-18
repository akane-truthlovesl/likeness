/** Finishing materials shared by the worlds: grain, vignette, soft volume. */

/** Film or paper grain laid over the whole plate. */
export const grain = (u, opacity = 0.14, freq = 0.9) => ({
  defs: `<filter id="${u}grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="4"/><feColorMatrix values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 0 1"/></filter>`,
  body: `<rect width="900" height="1200" filter="url(#${u}grain)" opacity="${opacity}" style="mix-blend-mode:overlay"/>`,
});

export const vignette = (u, strength = 0.5, color = '#000', inner = 0.5) => ({
  defs: `<radialGradient id="${u}vig" cx=".5" cy=".46" r=".78"><stop offset="${inner}" stop-color="${color}" stop-opacity="0"/><stop offset="1" stop-color="${color}" stop-opacity="${strength}"/></radialGradient>`,
  body: `<rect width="900" height="1200" fill="url(#${u}vig)"/>`,
});

/**
 * A lighting filter that turns flat shapes into lit volumes. The blurred alpha is the height map,
 * so every group it is applied to becomes its own lump.
 */
export const volume = (id, { bump = 7, depth = 7, wobble = 0, gloss = 0.5, shine = 14, light = [240, 120, 480], tint = '#fff6e8' } = {}) =>
  `<filter id="${id}" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
${wobble ? `<feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="5" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="${wobble}" xChannelSelector="R" yChannelSelector="G" result="g"/>` : '<feOffset in="SourceGraphic" result="g"/>'}
<feGaussianBlur in="g" stdDeviation="${bump}" result="b"/>
<feDiffuseLighting in="b" surfaceScale="${depth}" diffuseConstant="1.05" lighting-color="#ffffff" result="d"><fePointLight x="${light[0]}" y="${light[1]}" z="${light[2]}"/></feDiffuseLighting>
<feComposite in="d" in2="g" operator="in" result="di"/><feBlend in="g" in2="di" mode="multiply" result="lit"/>
<feSpecularLighting in="b" surfaceScale="${depth}" specularConstant="${gloss}" specularExponent="${shine}" lighting-color="${tint}" result="s"><fePointLight x="${light[0]}" y="${light[1]}" z="${light[2] * 0.8}"/></feSpecularLighting>
<feComposite in="s" in2="g" operator="in" result="si"/><feComposite in="si" in2="lit" operator="arithmetic" k2="1" k3="1"/></filter>`;
