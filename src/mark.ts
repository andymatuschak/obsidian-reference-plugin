import { keymap } from "@codemirror/view";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import {
	StateField,
	StateEffect,
	RangeSet,
	ChangeDesc,
} from "@codemirror/state";
import { SVG_HOVER_COLOR } from "./constants";

const addHighlight = StateEffect.define<{ from: number; to: number }>({
	map: ({ from, to }, change) => ({
		from: change.mapPos(from),
		to: change.mapPos(to),
	}),
});

const resetHighlight = StateEffect.define<{ from: number; to: number }>({
	map: ({ from, to }, change) => ({
		from: change.mapPos(from),
		to: change.mapPos(to),
	}),
});

const highlightField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(higlights, tr) {
		higlights = higlights.map(tr.changes);
		for (let e of tr.effects)
			if (e.is(addHighlight)) {
				higlights = higlights.update({
					add: [highlightMark.range(e.value.from, e.value.to)],
				});
			} else if (e.is(resetHighlight)) {
				higlights = higlights.update({ filter: (from, to) => false });
			}
		return higlights;
	},
	provide: (f) => EditorView.decorations.from(f),
});

const highlightMark = Decoration.mark({ class: "highlight" });
const highlightTheme = EditorView.baseTheme({
	".highlight": {
		"background-color": "white",
		color: "black",
	},
});
const defaultHighlightTheme = EditorView.baseTheme({
	".default-highlight": {
		"background-color": SVG_HOVER_COLOR,
		color: "black",
	},
});

export function highlightSelection(view: EditorView, from: number, to: number) {
	let effects: StateEffect<unknown>[] = [addHighlight.of({ from, to })];

	if (!effects.length) return false;

	if (!view.state.field(highlightField, false))
		effects.push(StateEffect.appendConfig.of([highlightField, highlightTheme]));

	view.dispatch({ effects });
	return true;
}

// have a function that adds subtle highlights to state
export function defaultHighlightSelection(
	view: EditorView,
	from: number,
	to: number
) {
	let effects: StateEffect<unknown>[] = [addHighlight.of({ from, to })];

	if (!effects.length) return false;

	if (!view.state.field(highlightField, false))
		effects.push(
			StateEffect.appendConfig.of([highlightField, defaultHighlightTheme])
		);

	view.dispatch({ effects });
	return true;
}

// update remove highlights so that
export function removeHighlights(view: EditorView) {
	if (!view) return;

	let effects: StateEffect<unknown>[] = view.state.selection.ranges.map(
		({ from, to }) => resetHighlight.of({ from, to })
	);
	if (effects.length) {
		view.dispatch({ effects });
		return true;
	}
	return false;
}
