import { validateMatchConfig } from "../content/contracts.js";

export function createMatchConfig({
  modeId = "tdm",
  stageId = "balanced",
  selectedFighterId = "blue",
  botCount = 3,
  inputProfile = "keyboard+gamepad",
} = {}) {
  return validateMatchConfig({
    modeId,
    stageId,
    selectedFighterId,
    botCount,
    inputProfile,
  });
}
