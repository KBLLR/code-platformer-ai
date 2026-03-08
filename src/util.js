/*
 * Get Url Parameter
 */
function GetUrlParam(param) {
  const needle = param.toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);

  for (const [key, value] of searchParams.entries()) {
    if (key.toLowerCase() !== needle) continue;
    return ["false"].includes(value.toLowerCase()) ? false : value;
  }

  return null;
}

export { GetUrlParam };
