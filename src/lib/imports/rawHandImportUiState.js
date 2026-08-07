export function rawHandImportStateReducer(state, action) {
  switch (action.type) {
    case "field_changed":
      return {
        ...state,
        form: { ...state.form, [action.field]: action.value },
        preview: null,
        result: null,
        error: "",
      };
    case "file_changed":
      return { ...state, file: action.file || null, preview: null, result: null, error: "" };
    case "request_started":
      return { ...state, busy: action.operation, error: "", ...(action.operation === "preview" ? { result: null } : {}) };
    case "preview_received":
      return { ...state, busy: "", preview: action.preview, result: null, error: "" };
    case "commit_received":
      return { ...state, busy: "", result: action.result, error: "" };
    case "request_failed":
      return { ...state, busy: "", error: action.error || "Request failed." };
    default:
      return state;
  }
}
