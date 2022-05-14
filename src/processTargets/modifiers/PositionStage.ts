import * as vscode from "vscode";
import { PositionModifier } from "../../typings/target.types";
import { ProcessedTargetsContext, TypedSelection } from "../../typings/Types";
import { ModifierStage } from "../PipelineStages.types";

export default class implements ModifierStage {
  run(
    context: ProcessedTargetsContext,
    stage: PositionModifier,
    selection: TypedSelection
  ): TypedSelection {
    const res: TypedSelection = {
      ...selection,
    };
    switch (stage.position) {
      case "before":
      case "start":
        res.contentRange = range(res.contentRange.start)!;
        res.interiorRange = range(res.interiorRange?.start);
        break;
      case "after":
      case "end":
        res.contentRange = range(res.contentRange.end)!;
        res.interiorRange = range(res.interiorRange?.end);
        break;
    }
    return res;
  }
}

function range(position?: vscode.Position) {
  return position ? new vscode.Range(position, position) : undefined;
}