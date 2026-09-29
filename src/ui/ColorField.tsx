import { IconCheck } from './icons'
import { isDark } from '../lib/design'

type Props = {
  label: string
  value: string
  colors: string[]
  onChange: (color: string) => void
  allowCustom?: boolean
}

export function ColorField({ label, value, colors, onChange, allowCustom = true }: Props) {
  const isCustom = !colors.includes(value.toLowerCase())

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => {
          const selected = color === value.toLowerCase()
          return (
            <button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={selected}
              onClick={() => onChange(color)}
              className="grid size-10 place-items-center rounded-full ring-1 ring-black/10 transition hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-accent aria-pressed:ring-offset-2 aria-pressed:ring-offset-paper"
              style={{ backgroundColor: color, color: isDark(color) ? '#fff' : '#2b2622' }}
            >
              {selected && <IconCheck width={16} height={16} />}
            </button>
          )
        })}
        {allowCustom && (
          <label
            className={`relative grid size-10 cursor-pointer place-items-center rounded-full ring-1 ring-black/10 transition hover:scale-110 has-focus-visible:outline-2 has-focus-visible:outline-accent ${isCustom ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper' : ''}`}
            style={{
              background: isCustom
                ? value
                : 'conic-gradient(#f87171, #fbbf24, #a3e635, #22d3ee, #818cf8, #f472b6, #f87171)',
            }}
            title="Color personalizado"
          >
            <span className="sr-only">Color personalizado</span>
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        )}
      </div>
    </fieldset>
  )
}
