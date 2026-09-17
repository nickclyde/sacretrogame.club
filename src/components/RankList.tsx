"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, type ReactNode } from "react";
import type { Option } from "@/data/polls";

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

type Props = {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Extra content on the right side of a row, e.g. drive times. */
  meta?: (id: string) => ReactNode;
  disabled?: boolean;
};

export function RankList({ options, value, onChange, meta, disabled }: Props) {
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = new Map(options.map((o) => [o.id, o]));
  const unranked = options.filter((o) => !value.includes(o.id));

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    onChange(arrayMove(value, value.indexOf(String(e.active.id)), value.indexOf(String(e.over.id))));
  }

  return (
    <div>
      {value.length === 0 ? (
        <p className="border-[3px] border-dashed border-muted px-4 py-5 text-muted">
          Nothing ranked yet. Tap your favorite below to make it 1st.
        </p>
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={value} strategy={verticalListSortingStrategy} disabled={disabled}>
            <ol className="flex flex-col gap-2">
              {value.map((id, i) => (
                <Row
                  key={id}
                  option={byId.get(id)!}
                  place={i}
                  last={i === value.length - 1}
                  meta={meta?.(id)}
                  disabled={disabled}
                  onMove={(d) => onChange(arrayMove(value, i, i + d))}
                  onRemove={() => onChange(value.filter((v) => v !== id))}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {unranked.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted">
            {value.length === 0 ? "Options" : "Not ranked (leave anything here that doesn't work for you)"}
          </p>
          <ul className="flex flex-col gap-2">
            {unranked.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange([...value, o.id])}
                  className="flex w-full items-center gap-3 border-[3px] border-ink/30 bg-panel/60 px-3 py-2 text-left hover:border-ink disabled:cursor-not-allowed"
                >
                  <span aria-hidden className="font-pixel text-xl text-muted">+</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-bold">{o.label}</span>
                    {o.detail && <span className="text-muted"> {o.detail}</span>}
                  </span>
                  {meta?.(o.id)}
                  <span className="sr-only">Add as {ORDINALS[value.length]} choice</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row(props: {
  option: Option;
  place: number;
  last: boolean;
  meta?: ReactNode;
  disabled?: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { option, place, last, meta, disabled, onMove, onRemove } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.id });
  const iconBtn = "grid h-9 w-9 place-items-center border-2 border-ink bg-white font-pixel text-lg disabled:opacity-30";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 border-[3px] border-ink bg-white px-2 py-2 ${isDragging ? "relative z-10 shadow-[6px_6px_0_var(--ink)]" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label={`Drag to reorder ${option.label} ${option.detail ?? ""}`}
        className="w-14 shrink-0 cursor-grab touch-none select-none font-pixel text-2xl uppercase text-purple active:cursor-grabbing"
      >
        {ORDINALS[place]}
      </button>
      <span className="min-w-0 flex-1">
        <span className="font-bold">{option.label}</span>
        {option.detail && <span className="text-muted"> {option.detail}</span>}
      </span>
      {meta}
      <span className="flex shrink-0 gap-1">
        <button type="button" className={iconBtn} disabled={disabled || place === 0} onClick={() => onMove(-1)} aria-label={`Move ${option.label} up`}>▲</button>
        <button type="button" className={iconBtn} disabled={disabled || last} onClick={() => onMove(1)} aria-label={`Move ${option.label} down`}>▼</button>
        <button type="button" className={iconBtn} disabled={disabled} onClick={onRemove} aria-label={`Remove ${option.label} from ranking`}>×</button>
      </span>
    </li>
  );
}
