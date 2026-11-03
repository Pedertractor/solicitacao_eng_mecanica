const flowPath = 'M60 51H301Q330 51 330 80V125H154Q125 125 125 154V212H265Q294 212 294 241V253H359';

export function FlowIllustration() {
  return (
    <svg viewBox='0 0 440 305' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' focusable='false'>
      <defs>
        <pattern id='flow-grid' width='20' height='20' patternUnits='userSpaceOnUse'>
          <circle cx='1' cy='1' r='.65' fill='#BDE8FF' fillOpacity='.22' />
        </pattern>
        <linearGradient id='flow-card' x1='0' y1='0' x2='180' y2='70' gradientUnits='userSpaceOnUse'>
          <stop stopColor='#218DCC' />
          <stop offset='1' stopColor='#1075B5' />
        </linearGradient>
        <linearGradient id='flow-route' x1='60' y1='51' x2='359' y2='253' gradientUnits='userSpaceOnUse'>
          <stop stopColor='#BCEAFF' stopOpacity='.8' />
          <stop offset='.5' stopColor='#CBEFFF' stopOpacity='.5' />
          <stop offset='1' stopColor='#F4CE57' stopOpacity='.9' />
        </linearGradient>
        <radialGradient id='flow-halo'>
          <stop stopColor='#83D3FF' stopOpacity='.2' />
          <stop offset='1' stopColor='#83D3FF' stopOpacity='0' />
        </radialGradient>
        <filter id='flow-particle-glow' x='-200%' y='-200%' width='500%' height='500%'>
          <feGaussianBlur stdDeviation='3' />
        </filter>
      </defs>

      <path fill='url(#flow-grid)' d='M0 0h440v305H0z' />
      <ellipse cx='225' cy='149' rx='200' ry='140' fill='url(#flow-halo)' />

      <g stroke='#A2DFFF' strokeOpacity='.12' strokeWidth='.8'>
        <path d='M0 92H78Q94 92 94 108V267H218M204 0V25Q204 38 217 38H398V204H440' />
        <circle cx='78' cy='92' r='3' fill='#8FD7FF' />
        <circle cx='398' cy='204' r='3' fill='#8FD7FF' />
        <path d='M12 22V12h10m396 270h10v-10' strokeOpacity='.7' />
      </g>

      <path d={flowPath} stroke='#A9DEFF' strokeOpacity='.07' strokeWidth='10' />
      <path d={flowPath} stroke='url(#flow-route)' strokeWidth='1.5' />
      <path className='flow-moving-dashes' d={flowPath} stroke='#D5F0FF' strokeOpacity='.3' strokeWidth='1.5' strokeDasharray='3 13' />

      {[0, -3.4, -6.8].map((begin) => (
        <g className='flow-particle' key={begin}>
          <circle r='7' fill='#FFE18A' opacity='.8' filter='url(#flow-particle-glow)' />
          <circle r='3' fill='#FFE18A' />
          <circle r='1.3' fill='#FFF7DA' />
          <animateMotion dur='10.2s' begin={`${begin}s`} repeatCount='indefinite' path={flowPath} />
        </g>
      ))}

      <g className='flow-step flow-step-one' transform='translate(22 22)'>
        <rect className='flow-card-outline' x='-3' y='-3' width='170' height='64' rx='13' stroke='#C6EAFF' strokeOpacity='0' />
        <rect width='164' height='58' rx='10' fill='url(#flow-card)' stroke='#9FD9F8' strokeOpacity='.55' />
        <rect x='13' y='13' width='32' height='32' rx='8' fill='#C6EBFF' fillOpacity='.1' />
        <g stroke='#D6F1FF' strokeWidth='1.4' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M23 21h10l4 5v12H21V21h2m10 0v6h4M25 31h8m-8 4h5' />
        </g>
        <g className='flow-label'>
          <text x='56' y='24' fill='#B8E1F9' fontSize='7' letterSpacing='1.3'>01 / O INÍCIO</text>
          <text x='56' y='41' fill='#F1FAFF' fontSize='13' fontWeight='500'>Solicitação</text>
        </g>
        <circle className='flow-step-indicator' cx='151' cy='11' r='2.5' fill='#F4CE57' />
      </g>

      <g className='flow-step flow-step-two' transform='translate(234 96)'>
        <rect className='flow-card-outline' x='-3' y='-3' width='182' height='64' rx='13' stroke='#C6EAFF' strokeOpacity='0' />
        <rect width='176' height='58' rx='10' fill='url(#flow-card)' stroke='#9FD9F8' strokeOpacity='.55' />
        <rect x='13' y='13' width='32' height='32' rx='8' fill='#C6EBFF' fillOpacity='.1' />
        <g stroke='#D6F1FF' strokeWidth='1.4' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M23 22h13v14H23zm4-3v6m5-6v6m-9 4h13m-9 3h1m3 0h1' />
        </g>
        <g className='flow-label'>
          <text x='56' y='24' fill='#B8E1F9' fontSize='7' letterSpacing='1.3'>02 / A DIREÇÃO</text>
          <text x='56' y='41' fill='#F1FAFF' fontSize='13' fontWeight='500'>Planejamento</text>
        </g>
        <circle className='flow-step-indicator' cx='163' cy='11' r='2.5' fill='#F4CE57' />
      </g>

      <g className='flow-step flow-step-three' transform='translate(43 183)'>
        <rect className='flow-card-outline' x='-3' y='-3' width='172' height='64' rx='13' stroke='#C6EAFF' strokeOpacity='0' />
        <rect width='166' height='58' rx='10' fill='url(#flow-card)' stroke='#9FD9F8' strokeOpacity='.55' />
        <rect x='13' y='13' width='32' height='32' rx='8' fill='#C6EBFF' fillOpacity='.1' />
        <g stroke='#D6F1FF' strokeWidth='1.4' strokeLinecap='round' strokeLinejoin='round'>
          <path d='m31 20-8 11h7l-2 8 9-12h-7z' />
        </g>
        <g className='flow-label'>
          <text x='56' y='24' fill='#B8E1F9' fontSize='7' letterSpacing='1.3'>03 / A AÇÃO</text>
          <text x='56' y='41' fill='#F1FAFF' fontSize='13' fontWeight='500'>Execução</text>
        </g>
        <circle className='flow-step-indicator' cx='153' cy='11' r='2.5' fill='#F4CE57' />
      </g>

      <g className='flow-complete' transform='translate(359 253)'>
        <circle className='flow-complete-ring' r='25' stroke='#F4CE57' strokeOpacity='.35' />
        <circle r='17' fill='#F4CE57' />
        <path d='m-7 0 5 5 9-10' stroke='#075F98' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
        <text className='flow-label' x='0' y='39' fill='#D5EBF8' fontSize='8' textAnchor='middle' letterSpacing='1'>CONCLUÍDO</text>
      </g>

      <g fill='#C3E5F8' fillOpacity='.65' fontSize='6.5' letterSpacing='1.3'>
        <text x='22' y='292'>CADA CONEXÃO MOVE O PRÓXIMO PASSO.</text>
      </g>
    </svg>
  );
}
