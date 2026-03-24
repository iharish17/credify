export async function fetchTemplateAsFile(templateId) {
  const response = await fetch(`/api/templates/${templateId}/download`);

  if (!response.ok) {
    const data = await safeParseJson(response);
    throw new Error(data.error || "Unable to fetch template from library.");
  }

  return createFileFromResponse(response, `template-${templateId}`);
}

export async function fetchFileFromUrlAsTemplate(url, fallbackName = "template") {
  const response = await fetch(url);

  if (!response.ok) {
    const data = await safeParseJson(response);
    throw new Error(data.error || "Unable to fetch template file.");
  }

  return createFileFromResponse(response, fallbackName);
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function parseFileNameFromDisposition(disposition) {
  if (!disposition || typeof disposition !== "string") {
    return "";
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return "";
}

async function createFileFromResponse(response, fallbackName) {
  const blob = await response.blob();
  const fileName =
    parseFileNameFromDisposition(response.headers.get("Content-Disposition")) ||
    fallbackName;

  return new File([blob], fileName, {
    type: blob.type || "application/octet-stream",
    lastModified: Date.now(),
  });
}
