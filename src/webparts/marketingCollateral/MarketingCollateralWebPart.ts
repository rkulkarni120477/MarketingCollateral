import * as React from "react";
import * as ReactDom from "react-dom";
import { BaseClientSideWebPart } from "@microsoft/sp-webpart-base";
import { CatalogueProvider, PreviewCatalogueProvider } from "./services/catalogueProvider";
import { MarketingCollateralApp } from "./components/MarketingCollateralApp";

export interface IMarketingCollateralWebPartProps {
  description: string;
}

export default class MarketingCollateralWebPart extends BaseClientSideWebPart<IMarketingCollateralWebPartProps> {
  public render(): void {
    const previewMode = CatalogueProvider.isLocalPreviewRequested();
    const provider = previewMode
      ? new PreviewCatalogueProvider()
      : new CatalogueProvider(this.context);
    const element = React.createElement(MarketingCollateralApp, { provider, previewMode });
    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }
}
