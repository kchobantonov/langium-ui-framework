import colors from 'colors';
import { Command } from 'commander';
import { languageMetaData } from '../language-server/generated/module';
import { SimpleUi } from '../language-server/generated/ast';
import { createSimpleUiServices } from '../language-server/simple-ui-module';
import { extractAstNode } from './cli-util';
import { generateHTML } from './generator-html';
import { generateCSS } from './generator-css';
import { generateJS } from './generator-js';

const program = new Command();

program
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .version(require('../../package.json').version);

program
    .command('generate')
    .argument('<file>', `possible file extensions: ${languageMetaData.fileExtensions.join(', ')}`)
    .option('-d, --destination <dir>', 'destination directory of generating')
    .description('generates HTML code based on the input')
    .action((fileName: string, opts: GenerateOptions) => {
        const model = extractAstNode<SimpleUi>(fileName, languageMetaData.fileExtensions, createSimpleUiServices());
        const generatedHTMLFilePath = generateHTML(model, fileName, opts.destination);
        const generatedCSSFilePath = generateCSS(model, fileName, opts.destination);
        const generatedJSFilePath = generateJS(model, fileName, opts.destination);
        console.log(colors.green('HTML code generated successfully:'), colors.yellow(generatedHTMLFilePath));
        console.log(colors.green('CSS code generated successfully:'), colors.yellow(generatedCSSFilePath));
        console.log(colors.green('JS code generated successfully:'), colors.yellow(generatedJSFilePath));
    });

program.parse(process.argv);

export type GenerateOptions = {
    destination?: string;
}