# External Vocabulary Shared-Core POC Notes

这个 POC 为 Dataverse Modern UI 和 legacy JSF 提供共享的 ORCID/ROR 数据处理逻辑。
当前共享的是 core，不是共享的 React UI：SPA 使用自己的 React UI，JSF 使用原生
JavaScript adapter。

## 新增文件

| 位置 | 用途 |
| --- | --- |
| `packages/external-vocabulary-core/external-vocabulary-core.js` | 浏览器可加载的 shared core。统一 ORCID/ROR 结果，并把选中的结果映射到 Dataverse managed fields。它也在浏览器中暴露 `DataverseExternalVocabularyCore`。 |
| `packages/external-vocabulary-core/external-vocabulary-core.mjs` | 给 Modern UI 打包时 import 的 ESM 入口。 |
| `packages/external-vocabulary-core/external-vocabulary-core.d.ts` | shared core 的 TypeScript 类型定义。 |
| `packages/external-vocabulary-core/external-vocabulary-core.test.js` | shared core 的单元测试。 |
| `packages/external-vocabulary-core/package.json` | 让 frontend 能以 `@iqss/dataverse-external-vocabulary-core` 依赖引用此 package。 |
| `packages/external-vocabulary-core/README.md` | package 的简短说明。 |
| `services/jsf-adapter/jsf-external-vocabulary-adapter.js` | JSF adapter。读取 Dataverse 输出的 `data-cvoc-*` 属性，显示 Person/Organization、搜索框和候选项，并把选择写回原有 JSF fields。它通过 Dataverse API 搜索，因此浏览器不会直接调用 ROR。 |
| `services/jsf-adapter/configs/authorsOrcidAndRorSharedCore.json` | JSF POC 的 `CVocConf` 示例，配置 Author/Contact 的 ORCID 和 ROR。 |
| `services/jsf-adapter/README.md` | JSF adapter 的使用说明。 |

## 修改的现有文件

| 位置 | 用途 |
| --- | --- |
| `scripts/deploy.js` | `node scripts/deploy.js link` 时，将 shared core 链接到 `dist/js/external-vocabulary-core.js`。 |
| `.gitignore` | 忽略生成的 `dist/` 目录，避免 symlink 输出出现在 Git diff 中。 |

## 未修改的既有服务

现有 GDCC provider scripts 没有被改动，包括：

- `services/ror/ror.js`
- 现有 ORCID/person-or-org services
- `services/skosmos/`、`services/geonames/`、`services/ontoportal/` 等

`dist/js/ror.js` 只是指向 `services/ror/ror.js` 的生成 symlink；它不是 POC 的 source
改动。当前 JSF POC 只加载 shared core 和 JSF adapter。

## 本地运行

生成本地脚本链接：

```sh
node scripts/deploy.js link
```

随后本地 nginx 将 `dist/` 暴露在 `/cvoc/`。JSF 的 `CVocConf` 依次加载：

```text
/cvoc/js/external-vocabulary-core.js
/cvoc/js/jsf-external-vocabulary-adapter.js
```

顺序不能改变，因为 JSF adapter 依赖 shared core。

## 下一步

目标是将 picker UI 提取为一个可复用的 React component，并通过两个 adapter 使用：

- SPA adapter：连接 React Hook Form 和 Modern UI repository。
- JSF adapter：用 `ReactDOM.createRoot()` 挂载相同 component，并同步 JSF fields。

完成前，请将当前实现描述为 **shared core with separate adapters**，不要描述为
shared React component。
