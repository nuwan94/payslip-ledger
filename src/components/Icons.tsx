import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
})

export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 6l4 4 4-4" /></svg>
export const IconChevronLeft = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M10 3L5 8l5 5" /></svg>
export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 3l5 5-5 5" /></svg>
export const IconCheck = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 8.5l3.2 3L13 4.5" /></svg>
export const IconClose = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 4l8 8M12 4l-8 8" /></svg>
export const IconPlus = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M8 3v10M3 8h10" /></svg>
export const IconTrash = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8" /></svg>
export const IconUpload = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M8 11V3M5 6l3-3 3 3M3 13h10" /></svg>
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>
export const IconPin = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="8" cy="5.5" r="2.7" /><path d="M8 8.2V14" /></svg>
export const IconInfo = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="8" cy="8" r="6" /><path d="M8 7.2v4M8 5v.1" /></svg>
