import React, { memo, useCallback } from "react";
import { API } from "storybook/internal/manager-api";
import { IconButton } from "storybook/internal/components";
import { DownloadIcon } from "@storybook/icons";

interface ToolProps {
  api: API;
}

export const Tool = memo(function MyAddonSelector({ api }: ToolProps) {
  const downloadPrefab = useCallback(async () => {
    // Get the current story/component data
    const currentStory = api.getCurrentStoryData();

    console.log("Current story data:", currentStory);
    console.log("Running version 1.0.6");
    if (!currentStory || !currentStory.importPath) {
      console.error("No story is currently rendered or importPath is missing.");
      return;
    }

    // Extract component name from importPath
    const importPath = currentStory.importPath; // e.g., "./src/stories/Button.stories.ts"
    const componentNameMatch = importPath.match(/\/([^/]+)\.stories\.\w+$/); // Regex to extract component name
    let componentName = componentNameMatch ? componentNameMatch[1] : null;
    componentName = componentName.toLowerCase();
    if (!componentName) {
      console.error("Failed to extract component name from importPath:", importPath);
      alert("Could not determine the component name.");
      return;
    }

    // Construct the zip URL based on the extracted component name
    const zipUrl = `/${componentName}.zip`;

    try {
      const response = await fetch(zipUrl);
      if (!response.ok) throw new Error(`Failed to fetch zip: ${zipUrl}`);

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${componentName}.zip`;
      link.click();

      console.log(`Download started for ${componentName}.zip`);
    } catch (err) {
      console.error("Failed to download prefab zip:", err);
      alert("Failed to download prefab zip.");
    }
  }, [api]);

  return (
    <IconButton key="addon/my-addon/tool" title="Download prefab" onClick={downloadPrefab}>
      <DownloadIcon />
    </IconButton>
  );
});
