import {AngularCompilerPlugin, NgToolsLoader, PLATFORM} from "@ngtools/webpack";
import {DefinePlugin} from "webpack";
import {readConfiguration} from "@angular/compiler-cli";

import {BuildAngularCompilationFlags, BuildEnvironment} from "webpack-configs/model";
import {ENVIRONMENT, rootRelativePath} from "webpack-configs/lib";
import {WEB_CHUNK_NAMES} from "src/shared/constants";
import {browserWindowAppPath, browserWindowPath, buildBaseWebConfig, cssRuleSetRules} from "./lib";

const angularCompilationFlags: BuildAngularCompilationFlags = {
    aot: true,
    ivy: true,
};

const tsConfigFile = browserWindowPath(({
    production: "./tsconfig.json",
    development: "./tsconfig.development.json",
    test: "./test/tsconfig.json",
} as Record<BuildEnvironment, string>)[ENVIRONMENT]);

const config = buildBaseWebConfig(
    {
        module: {
            rules: [
                {
                    test: angularCompilationFlags.aot
                        ? /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/
                        : /\.ts$/,
                    use: [
                        "@angular-devkit/build-optimizer/webpack-loader",
                        NgToolsLoader,
                    ],
                },
                {
                    test: /[/\\]@angular[/\\].+\.js$/,
                    sideEffects: false,
                    parser: {
                        system: true,
                    },
                },
                {
                    test: /\.scss$/,
                    use: [
                        "to-string-loader",
                        ...cssRuleSetRules(),
                        "resolve-url-loader",
                        "sass-loader",
                    ],
                    include: [
                        browserWindowAppPath(),
                    ],
                },
            ],
        },
        resolve: {
            alias: {
                images: rootRelativePath("images"),
            },
        },
        plugins: [
            new DefinePlugin({
                BUILD_ANGULAR_COMPILATION_FLAGS: JSON.stringify(angularCompilationFlags),
            }),
            (() => {
                type StrictTemplateOptions
                    = NoExtraProps<Required<import("@angular/compiler-cli/src/ngtsc/core/api").StrictTemplateOptions>>;
                const strictTemplateOptions: NoExtraProps<Pick<StrictTemplateOptions, "strictTemplates">> = {
                    // if "true", implies all template strictness flags below (unless individually disabled)
                    // see https://angular.io/guide/template-typecheck
                    strictTemplates: angularCompilationFlags.ivy,
                };

                type LegacyNgcOptions
                    = NoExtraProps<Required<Pick<import("@angular/compiler-cli/src/ngtsc/core/api").LegacyNgcOptions,
                    | "fullTemplateTypeCheck"
                    | "strictInjectionParameters">>>;
                const legacyNgcOptions: LegacyNgcOptions = {
                    fullTemplateTypeCheck: angularCompilationFlags.aot || angularCompilationFlags.ivy,
                    strictInjectionParameters: true,
                };

                type AngularCompilerPluginOptions
                    = NoExtraProps<import("@ngtools/webpack/src/interfaces").AngularCompilerPluginOptions>;
                const compilerOptions: StrictOmit<Required<AngularCompilerPluginOptions>["compilerOptions"],
                    // skipping raw "string" props
                    Extract<keyof Required<AngularCompilerPluginOptions>["compilerOptions"], string>> = {
                    preserveWhitespaces: false,
                    disableTypeScriptVersionCheck: true,
                    enableIvy: angularCompilationFlags.ivy,
                    ...legacyNgcOptions,
                    ...strictTemplateOptions,
                    ...readConfiguration(tsConfigFile).options,
                };

                /* eslint-disable max-len */
                // https://github.com/angular/angular-devkit-build-angular-builds/blob/e8499b649475ae03b1519f181b982ce568b86c49/src/webpack/configs/typescript.js
                // https://github.com/angular/ngtools-webpack-builds/blob/4ee7f6f5d3f611ad29832bd27e984f1a46a99421/README.md
                // https://github.com/angular/angular-cli/blob/9980f8139cfcdd2a8e928a3a93b7af455ba25ea4/packages/ngtools/webpack/README.md
                // eslint-disable-next-line max-len
                const angularCompilerPluginOptions: AngularCompilerPluginOptions = {
                    // contextElementDependencyConstructor: require("webpack/lib/dependencies/ContextElementDependency"),
                    tsConfigPath: tsConfigFile,
                    compilerOptions,
                    platform: PLATFORM.Browser,
                    skipCodeGeneration: !angularCompilationFlags.aot,
                    nameLazyFiles: true,
                    discoverLazyRoutes: true, // TODO disable "discoverLazyRoutes" once switched to Ivy renderer
                    directTemplateLoading: false,
                    entryModule: `${browserWindowAppPath("./app.module")}#AppModule`,
                };

                return new AngularCompilerPlugin(angularCompilerPluginOptions);
            })(),
        ],
        optimization: {
            splitChunks: {
                cacheGroups: {
                    defaultVendors: false,
                    vendors: {
                        test: /[\\/]node_modules[\\/]/,
                        priority: -10,
                        filename({chunk}) {
                            if (!chunk?.hash) {
                                throw new Error(`Invalid "chunk.hash" value`);
                            }
                            return `vendor_${chunk.hash}.js`;
                        },
                    },
                    styles: {
                        name: "shared-vendor",
                        test: /[\\/]vendor[\\/]shared-vendor\.scss$/,
                        chunks: "all",
                        enforce: true,
                    },
                },
            },
        },
    },
    {
        tsConfigFile,
        chunkName: WEB_CHUNK_NAMES["browser-window"],
    },
);

export default config;
