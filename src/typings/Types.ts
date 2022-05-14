import { SyntaxNode } from "web-tree-sitter";
import * as vscode from "vscode";
import { ExtensionContext, Location, Selection } from "vscode";
import { EditStyles } from "../core/editStyles";
import HatTokenMap from "../core/HatTokenMap";
import { Snippets } from "../core/Snippets";
import { RangeUpdater } from "../core/updateSelections/RangeUpdater";
import { FullRangeInfo } from "./updateSelections";
import Decorations from "../core/Decorations";
import FontMeasurements from "../core/FontMeasurements";
import { CommandServerApi } from "../util/getExtensionApi";
import { ReadOnlyHatMap } from "../core/IndividualHatMap";
import Debug from "../core/Debug";
import { TestCaseRecorder } from "../testUtil/TestCaseRecorder";
import { SelectionType, Position } from "./target.types";

/**
 * A token within a text editor, including the current display line of the token
 */
export interface Token extends FullRangeInfo {
  editor: vscode.TextEditor;
  displayLine: number;
}

export interface ProcessedTargetsContext {
  hatTokenMap: ReadOnlyHatMap;
  thatMark: SelectionWithEditor[];
  sourceMark: SelectionWithEditor[];
  getNodeAtLocation: (location: Location) => SyntaxNode;
}

export interface SelectionWithEditor {
  selection: vscode.Selection;
  editor: vscode.TextEditor;
}

export interface SelectionContext {
  isInDelimitedList?: boolean;
  containingListDelimiter?: string | null;

  /**
   * Selection used for outside selection
   */
  outerSelection?: vscode.Selection | null;

  /**
   * The range of the delimiter before the selection
   */
  leadingDelimiterRange?: vscode.Range | null;

  /**
   * The range of the delimiter after the selection
   */
  trailingDelimiterRange?: vscode.Range | null;

  isNotebookCell?: boolean;

  /**
   * Represents the boundary ranges of this selection. For example, for a
   * surrounding pair this would be the opening and closing delimiter. For an if
   * statement this would be the line of the guard as well as the closing brace.
   */
  boundary?: SelectionWithContext[];

  /**
   * Represents the interior ranges of this selection. For example, for a
   * surrounding pair this would exclude the opening and closing delimiter. For an if
   * statement this would be the statements in the body.
   */
  interior?: SelectionWithContext[];

  /**
   * Indicates that this is a raw selection with no type information so for
   * example if it is the destination of a bring or move it should inherit the
   * type information such as delimiters from its source
   */
  isRawSelection?: boolean;
}

/**
 * Represents a selection in a particular document along with potential rich
 * context information such as how to remove the given selection
 */
// export interface TypedSelection {
//   /**
//    * The selection.  If insideOutsideType is non-null, it will be adjusted to
//    * include delimiter if outside
//    */
//   selection: SelectionWithEditor;
//   selectionContext: SelectionContext;

//   /**
//    * Mirrored from the target from which this selection was constructed
//    */
//   position: Position;
// }

export interface TypedSelection {
  /**
   * The text editor used for all ranges
   */
  editor: vscode.TextEditor;

  /**
   * If true active is before anchor
   */
  isReversed?: boolean;

  /**
   * Indicates that this is a raw selection with no type information so for
   * example if it is the destination of a bring or move it should inherit the
   * type information such as delimiters from its source
   */
  isRawSelection?: boolean;

  /**
   * If this selection has a delimiter. For example, new line for a line or paragraph and comma for a list or argument
   */
  delimiter?: string;

  /**
   * The range of the content
   */
  contentRange: vscode.Range;

  /**
   * Represents the interior range of this selection. For example, for a
   * surrounding pair this would exclude the opening and closing delimiter. For an if
   * statement this would be the statements in the body.
   */
  interiorRange?: vscode.Range;

  /**
   * The range of the delimiter before the content selection
   */
  leadingDelimiterRange?: vscode.Range;

  /**
   * The range of the delimiter after the content selection
   */
  trailingDelimiterRange?: vscode.Range;

  /**
   * Represents the boundary ranges of this selection. For example, for a
   * surrounding pair this would be the opening and closing delimiter. For an if
   * statement this would be the line of the guard as well as the closing brace.
   */
  boundary?: vscode.Range[];
}

export interface ActionPreferences {
  position?: Position;
  insideOutsideType: InsideOutsideType;
  selectionType?: SelectionType;
  modifier?: Modifier;
}

export interface SelectionWithContext {
  selection: vscode.Selection;
  context: SelectionContext;
}

export interface ActionReturnValue {
  returnValue?: any;
  thatMark?: SelectionWithEditor[];
  sourceMark?: SelectionWithEditor[];
}

export interface Action {
  run(targets: TypedSelection[][], ...args: any[]): Promise<ActionReturnValue>;

  /**
   * Used to define default values for parts of target during inference.
   * @param args Extra args to command
   */
  getTargetPreferences(...args: any[]): ActionPreferences[];
}

export type ActionType =
  | "callAsFunction"
  | "clearAndSetSelection"
  | "copyToClipboard"
  | "cutToClipboard"
  | "deselect"
  | "editNewLineAfter"
  | "editNewLineBefore"
  | "executeCommand"
  | "extractVariable"
  | "findInWorkspace"
  | "foldRegion"
  | "followLink"
  | "getText"
  | "highlight"
  | "indentLine"
  | "insertCopyAfter"
  | "insertCopyBefore"
  | "insertEmptyLineAfter"
  | "insertEmptyLineBefore"
  | "insertEmptyLinesAround"
  | "moveToTarget"
  | "outdentLine"
  | "pasteFromClipboard"
  | "remove"
  | "replace"
  | "replaceWithTarget"
  | "reverseTargets"
  | "rewrapWithPairedDelimiter"
  | "scrollToBottom"
  | "scrollToCenter"
  | "scrollToTop"
  | "setSelection"
  | "setSelectionAfter"
  | "setSelectionBefore"
  | "sortTargets"
  | "swapTargets"
  | "toggleLineBreakpoint"
  | "toggleLineComment"
  | "unfoldRegion"
  | "wrapWithPairedDelimiter"
  | "wrapWithSnippet";

export type ActionRecord = Record<ActionType, Action>;

export interface Graph {
  /**
   * Keeps a map from action names to objects that implement the given action
   */
  readonly actions: ActionRecord;

  /**
   * Maintains decorations that can be used to visually indicate to the user
   * the targets of their actions.
   */
  readonly editStyles: EditStyles;

  /**
   * Maps from (hatStyle, character) pairs to tokens
   */
  readonly hatTokenMap: HatTokenMap;

  /**
   * The extension context passed in during extension activation
   */
  readonly extensionContext: ExtensionContext;

  /**
   * Keeps a merged list of all user-contributed, core, and
   * extension-contributed cursorless snippets
   */
  readonly snippets: Snippets;

  /**
   * This component can be used to register a list of ranges to keep up to date
   * as the document changes
   */
  readonly rangeUpdater: RangeUpdater;

  /**
   * Responsible for all the hat styles
   */
  readonly decorations: Decorations;

  /**
   * Takes measurements of the user's font
   */
  readonly fontMeasurements: FontMeasurements;

  /**
   * API object for interacting with the command server, if it exists
   */
  readonly commandServerApi: CommandServerApi | null;

  /**
   * Function to access nodes in the tree sitter.
   */
  readonly getNodeAtLocation: (location: vscode.Location) => SyntaxNode;

  /**
   * Debug logger
   */
  readonly debug: Debug;

  /**
   * Used for recording test cases
   */
  readonly testCaseRecorder: TestCaseRecorder;
}

export type NodeMatcherValue = {
  node: SyntaxNode;
  selection: SelectionWithContext;
};

export type NodeMatcherAlternative = NodeMatcher | string[] | string;

export type NodeMatcher = (
  selection: SelectionWithEditor,
  node: SyntaxNode
) => NodeMatcherValue[] | null;

/**
 * Returns the desired relative of the provided node.
 * Returns null if matching node not found.
 **/
export type NodeFinder = (
  node: SyntaxNode,
  selection?: vscode.Selection
) => SyntaxNode | null;

/** Returns one or more selections for a given SyntaxNode */
export type SelectionExtractor = (
  editor: vscode.TextEditor,
  nodes: SyntaxNode
) => SelectionWithContext;

/** Represent a single edit/change in the document */
export interface Edit {
  range: vscode.Range;
  text: string;

  /**
   * If this edit is an insertion, ie the range has zero length, then this
   * field can be set to `true` to indicate that any adjacent empty selection
   * should *not* be shifted to the right, as would normally happen with an
   * insertion. This is equivalent to the
   * [distinction](https://code.visualstudio.com/api/references/vscode-api#TextEditorEdit)
   * in a vscode edit builder between doing a replace with an empty range
   * versus doing an insert.
   */
  isReplace?: boolean;
}
