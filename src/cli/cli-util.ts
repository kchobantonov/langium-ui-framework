import fs from 'fs';
import colors from 'colors';
import { LangiumDocument, LangiumServices } from 'langium';
import path from 'path';
import { URI } from 'vscode-uri';
import { GenerateOptions } from '.';
import { WorkspaceFolder } from 'vscode-languageserver';

export async function extractDocument(fileName: string, extensions: string[], services: LangiumServices, options: GenerateOptions): Promise<GeneratorResult> {
    let success = true;
    if (!extensions.includes(path.extname(fileName))) {
        console.error(colors.yellow(`Please, choose a file with one of these extensions: ${extensions}.`));
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(colors.red(`File ${fileName} doesn't exist.`));
        process.exit(1);
    }

    const document = services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(path.resolve(fileName)));
    await services.shared.workspace.DocumentBuilder.build([document], { validationChecks: 'all' });

    const validationErrors = (document.diagnostics ?? []).filter(e => e.severity === 1);
    if (validationErrors.length > 0) {
        success = false;
        console.error(colors.red('There are validation errors:'));
        for (const validationError of validationErrors) {
            console.error(colors.red(
                `line ${validationError.range.start.line}: ${validationError.message} [${document.textDocument.getText(validationError.range)}]`
            ));
        }
        if(!options.watch){
            process.exit(1);
        } 

    }

    return {
        document: document,
        success: success
    }
}


export async function setRootFolder(fileName: string, services: LangiumServices, root?: string): Promise<void> {
    if (!root) {
        root = path.dirname(fileName);
    }
    if (!path.isAbsolute(root)) {
        root = path.resolve(process.cwd(), root);
    }
    const folders: WorkspaceFolder[] = [{
        name: path.basename(root),
        uri: URI.file(root).toString()
    }];
    await services.shared.workspace.WorkspaceManager.initializeWorkspace(folders);
}

interface FilePathData {
    destination: string,
    name: string
}

export interface GeneratorResult { 
    document: LangiumDocument;
    success: boolean;
}

export function extractDestinationAndName(filePath: string, destination: string | undefined): FilePathData {
    filePath = filePath.replace(/\..*$/, '').replace(/[.-]/g, '');
    return {
        destination: destination ?? `${path.dirname(filePath)}/generated/`,
        name: path.basename(filePath)
    };
}
