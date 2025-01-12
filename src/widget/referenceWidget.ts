import {
	EditorView,
	WidgetType,
	Decoration,
	DecorationSet,
	ViewPlugin,
	ViewUpdate,
	MatchDecorator,
	gutter,
	GutterMarker,
} from "@codemirror/view";

import {
	openReference,
	createReferenceIcon,
	generateBacklinks,
	createBacklinkMark,
	updateBacklinkMarkPositions,
} from "../references";
import { decodeURIComponentString, encodeURIComponentString } from "src/utils";
import { getBacklinks } from "src/state";

/* new placeholder */
class ReferenceWidget extends WidgetType {
	constructor(
		private name: string,
		private view: EditorView,
		private pos: number
	) {
		super();
	}

	eq(other: ReferenceWidget) {
		return this.name === other.name;
	}

	async updateName(name: string) {
		const from = this.pos;
		// text length for these two states is different
		// const to = this.pos + name.length + (toggle == "t" ? 3 : -3);
		const to = this.pos + name.length;
		const transaction = this.view.state.update({
			changes: { from, to, insert: name },
		});
		this.view.dispatch(transaction);

		await updateBacklinkMarkPositions();
		this.name = name;
	}

	getView() {
		return this.view;
	}

	toDOM() {
		const regex = /\[↗\]\(urn:([^)]*)\)/g;
		let content = regex.exec(this.name);
		if (!content) throw new Error("Invalid reference");
		const [prefix, text, suffix, file, from, to, portal, toggle = "f"] =
			content[1].split(":");

		const { span, svg } = createReferenceIcon(
			portal == "portal" ? "inline reference widget |*|" : null
		);

		if (content) span.setAttribute("data", content[1]);

		const containerSpan = document.createElement("span");
		const referenceSpan = document.createElement("span");
		// add class
		referenceSpan.classList.add("reference-span");

		referenceSpan.innerHTML = decodeURIComponentString(text);
		referenceSpan.style.border = "1px solid white";
		referenceSpan.style.paddingLeft = "2px";
		referenceSpan.style.paddingRight = "2px";
		referenceSpan.style.borderRadius = "3px";
		if (toggle == "f") referenceSpan.style.display = "none";

		containerSpan.appendChild(referenceSpan);
		containerSpan.appendChild(span);

		const observer = new MutationObserver(async (mutationsList) => {
			for (const mutation of mutationsList) {
				if (
					mutation.type === "attributes" &&
					mutation.attributeName === "style"
				) {
					// Handle style changes here
					let newToggle = referenceSpan.style.display === "none" ? "f" : "t";
					let reference = `[↗](urn:${prefix}:${text}:${suffix}:${file}:${from}:${to}:${portal}:${newToggle})`;

					await this.updateName(reference);
				}
			}
		});

		observer.observe(referenceSpan, { attributes: true });

		span.addEventListener("click", (ev) => {
			if (ev.metaKey || ev.ctrlKey) {
				if (referenceSpan.style.display === "none") {
					referenceSpan.style.display = "inline";
				} else {
					referenceSpan.style.display = "none";
				}
			} else {
				openReference(ev);
			}
		});

		return containerSpan;
	}
}

const referenceDecoration = (
	match: RegExpExecArray,
	view: EditorView,
	pos: number
) => {
	let decoration = Decoration.replace({
		widget: new ReferenceWidget(match[0], view, pos),
	});
	return decoration;
};

const referenceMatcher = new MatchDecorator({
	// regexp: /\[\u2197\]\(urn:[\s\S^\)]*\)/g,
	// regexp: /\[\u2197\]\(urn:([^:]*:){5,6}[^:]*\)/g,
	// regexp: /\[\u2197\]\(urn:([^:]*:){6}[^:)]*\)/g,
	regexp: /\[\u2197\]\(urn:([^:]*:){7}[^:)]*\)/g,
	decoration: (match, view, pos) => {
		return referenceDecoration(match, view, pos);
	},
});

export const referenceResources = ViewPlugin.fromClass(
	class {
		referenceResources: DecorationSet;
		constructor(view: EditorView) {
			this.referenceResources = referenceMatcher.createDeco(view);
		}
		update(update: ViewUpdate) {
			this.referenceResources = referenceMatcher.updateDeco(
				update,
				this.referenceResources
			);
		}
		destroy() {
			this.referenceResources = Decoration.none;
		}
	},
	{
		decorations: (instance) => instance.referenceResources,
		provide: (plugin) =>
			EditorView.atomicRanges.of((view) => {
				return view.plugin(plugin)?.referenceResources || Decoration.none;
			}),
	}
);
