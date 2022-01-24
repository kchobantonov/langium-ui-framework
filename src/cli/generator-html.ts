import fs from 'fs';
import { AstNode, CompositeGeneratorNode, NL, processGeneratorNode } from 'langium';
import { GenericNotificationHandler } from 'vscode-jsonrpc';
import { integer } from 'vscode-languageserver-types';
import { Button, Component, CSSElements, Div, Expression, Heading, Icon, Image, Import, isNumberExpression, isOperation, isStringExpression, isSymbolReference, Link, Paragraph, Parameter, reflection, SimpleExpression, SimpleUi, SimpleUIAstType, Textbox, Title, Topbar, UseComponent } from '../language-server/generated/ast';
import { extractDestinationAndName } from './cli-util';

export type GenerateFunctions = {
    [key in SimpleUIAstType]?:(el: AstNode, ctx:GeneratorContext)=>string|CompositeGeneratorNode
}

type GeneratorContext = {
    argumentStack: Object[][]
}


export function generateHTML(model: SimpleUi, filePath: string, destination: string | undefined): string {
    const data = extractDestinationAndName(filePath, destination);
    const generatedFilePath = `${data.destination}index.html`;
    const ctx:GeneratorContext = {argumentStack:[]}
    const fileNode = new CompositeGeneratorNode();
    fileNode.append('<!DOCTYPE html>', NL);
    fileNode.append('<html>', NL);
    fileNode.indent(head => {
        head.append('<head>', NL);
        head.indent(headcontent => {
            generateHead(model, headcontent, ctx);
            headcontent.append('<link rel="stylesheet" href="stylesheet.css">', NL);
            headcontent.append('<script src="script.js"></script>', NL)
        });
        head.append('</head>', NL);
    });
    fileNode.indent(body => {
        body.append('<body>', NL);
        body.indent(bodycontent => {
            generateBody(model, bodycontent, ctx);
        });
        body.append('</body>', NL);
    });
    fileNode.append('</html>', NL);

    if (!fs.existsSync(data.destination)) {
        fs.mkdirSync(data.destination, { recursive: true });
    }
    fs.writeFileSync(generatedFilePath, processGeneratorNode(fileNode));
    return generatedFilePath;
}

// Head generate functions
const titleFunc = (titleEL: AstNode, ctx:GeneratorContext) => {
    const el = titleEL as Title;
    return `<title>${generateExpression(el.text, ctx)}</title>`
}

const iconFunc = (iconEL: AstNode, ctx:GeneratorContext) => {
    const el = iconEL as Icon;
    return `<link rel="icon" href="${generateExpression(el.imagepath, ctx)}">`;
}
// Body generate functions
const divFunc = (divEl: AstNode, ctx:GeneratorContext) => {
    const el = divEl as Div;
    const fileNode = new CompositeGeneratorNode()
    fileNode.append('<div>', NL)
    fileNode.indent(divcontent => {
        generateBody(el.content, divcontent, ctx)
    });
    fileNode.append('</div>')
    return fileNode
};

const paragraphFunc = (paragraphEl: AstNode, ctx:GeneratorContext) => {
    const el = paragraphEl as Paragraph;
    if (generateInlineCSS(el, ctx) === '') {
        return `<p>${generateExpression(el.text, ctx)}</p>`;
    }
    else {
        return `<p style='${generateInlineCSS(el, ctx)}'>${generateExpression(el.text, ctx)}</p>`;
    }
};

const buttonFunc = (buttonEL: AstNode, ctx:GeneratorContext) => {
    const el = buttonEL as Button;
    if (typeof el.onclickaction === 'undefined') {
        return `<button>${generateExpression(el.buttontext, ctx)}</button>`;
    }
    else {
        return `<button onclick='${el.onclickaction.ref?.name}(${generateParameters(el.arguments, ctx)})'>${generateExpression(el.buttontext, ctx)}</button>`;
    };
};

const linkFunc = (linkEL: AstNode, ctx:GeneratorContext) => {
    const el = linkEL as Link;
    if (typeof el.linktext === 'undefined') {
        return `<a href='${generateExpression(el.linkurl, ctx)}'>${generateExpression(el.linkurl, ctx)}</a>`;
    }
    else {
        return `<a href='${generateExpression(el.linkurl, ctx)}'>${generateExpression(el.linktext, ctx)}</a>`;
    };
};

const textboxFunc = (textboxEL: AstNode, ctx:GeneratorContext) => {
    const el = textboxEL as Textbox;
    const fileNode = new CompositeGeneratorNode()
    const labelOrder = []

    if (typeof el.placeholdertext === 'undefined') {
        labelOrder.push(`<input type='text' id='${el.name}'>`);
    }
    else {
        labelOrder.push(`<input type='text' id='${el.name}' placeholder='${generateExpression(el.placeholdertext, ctx)}'>`);
    };
    console.log(typeof el.labelAfter)
    if (typeof el.labeltext !== 'undefined' && !el.labelAfter) {
        labelOrder.unshift(`<label for='${el.name}'>${generateExpression(el.labeltext, ctx)}</label>`, NL);
    } 
    else if (typeof el.labeltext !== 'undefined' && el.labelAfter){
        labelOrder.push(NL,`<label for='${el.name}'>${generateExpression(el.labeltext, ctx)}</label>`);
    }
    labelOrder.map(el => {
        fileNode.append(el)
    })
    return fileNode
};

const linebreakFunc = (linebreakEL: AstNode, ctx:GeneratorContext) => {
    return '<br>';
};

const imageFunc = (imageEL: AstNode, ctx:GeneratorContext) => {
    const el = imageEL as Image;
    if (generateInlineCSS(el, ctx) === '') {
        return `<img src='${generateExpression(el.imagepath, ctx)}' alt='${el.altText!==undefined?el.altText:''}'>`
    }
    else {
        return `<img src='${generateExpression(el.imagepath, ctx)}' alt='${el.altText!==undefined?el.altText:''}' style='${generateInlineCSS(el, ctx)}'>`
    }
}

const headingFunc = (headingEL: AstNode, ctx:GeneratorContext) => {
    const el = headingEL as Heading;
    if (generateInlineCSS(el, ctx) === '') {
        return `<h${el.level}>${generateExpression(el.text, ctx)}</h${el.level}>`
    }
    else {
        return `<h${el.level} style='${generateInlineCSS(el, ctx)}'>${generateExpression(el.text, ctx)}</h${el.level}>`
    }
}

const useComponentFunc = (UseComponentEL: AstNode, ctx:GeneratorContext) => {
    const el = UseComponentEL as UseComponent;
    const componentNode = new CompositeGeneratorNode()
    const refContent = el.component.ref?.content as SimpleUi
    const refParameters = (refContent.$container as Component).parameters;
    const argumentList = refParameters.map(function (refEl: Parameter, index:integer) {
        return ({name: refEl.name, type: refEl.type, value: generateExpression(el.arguments[index], ctx)})
    })
    ctx.argumentStack.push(argumentList);
    console.log(refContent);
    generateComponent(refContent, componentNode, ctx);
    ctx.argumentStack.pop();
    return componentNode;
}

const importFunc = (ImportEL: AstNode, ctx:GeneratorContext) => {
    const el = ImportEL as Import
    // TODO: Add Import
}

const topbarFunc = (TopbarEl: AstNode, ctx:GeneratorContext) => {
    const el = TopbarEl as Topbar;
    const topbarNode = new CompositeGeneratorNode()

    topbarNode.append(`<header class='topbar ${el.fixed?'topbar--fixed':''}' style='${generateInlineCSS(el,ctx)}'>`,NL);
    topbarNode.indent(topbarContent => {
        topbarContent.append(`<nav>`,NL);
        topbarContent.indent(navigationContent => {
            navigationContent.append(`<a style='${generateInlineCSS(el,ctx)}' href='./'>${generateExpression(el.value, ctx)}</a>`,NL)
        });
        topbarContent.append(`</nav>`,NL);
    })
    topbarNode.append(`</header>`);
    /*previous way of generating html
    if (generateInlineCSS(el, ctx) === '') {
        topbarNode.append(`<div style='background-color: #333; overflow: hidden;' class='topbar'>`, NL)
        topbarNode.indent(topbarContent => {
            topbarContent.append(`<p style='color: #f2f2f2; margin-left: 1%; font-size: 17px;'>${generateExpression(el.value, ctx)}</p>`)
        })
        topbarNode.append('</div>')
    }
    else {
        topbarNode.append(`<div style='${generateInlineCSS(el, ctx)} overflow: hidden;' class='topbar'>`, NL)
        topbarNode.indent(topbarContent => {
            topbarContent.append(`<p style='${generateInlineCSS(el,ctx)} margin-left: 1%;'>${generateExpression(el.value, ctx)}</p>`)
        })
        topbarNode.append('</div>')
    }
    */
    return topbarNode
}

// Redirect to generator function by Type

// Head functions
export const generateHeadFunctions: GenerateFunctions = {
    Title: titleFunc,
    Icon: iconFunc
};

// Body functions
export const generateBodyFunctions: GenerateFunctions = {
    Div: divFunc,
    Paragraph: paragraphFunc,
    Button: buttonFunc,
    Link: linkFunc,
    Textbox: textboxFunc,
    Linebreak: linebreakFunc,
    Image: imageFunc,
    Heading: headingFunc,
    UseComponent: useComponentFunc,
    Topbar: topbarFunc
};

function generateExpression(expression: Expression|SimpleExpression, ctx:GeneratorContext):string|number {
    if (isStringExpression(expression)){
        return expression.value
    }
    else if (isNumberExpression(expression)){
        return expression.value
    }
    else if (isSymbolReference(expression)){
        let value = ''
        ctx.argumentStack[0].forEach(function (el) {
            if ((el as any).name === expression.symbol.ref?.name) {
                value = (el as any).value 
            }
        })
        return value
    }
    else if (isOperation(expression)) {
        let result, left, right
        if (isStringExpression(expression.left) || typeof(generateExpression(expression.left, ctx)) === 'string') {
            left = `'${generateExpression(expression.left, ctx)}'`
        } else {
            left = generateExpression(expression.left, ctx)
        }
        if (isStringExpression(expression.right) || typeof(generateExpression(expression.right, ctx)) === 'string') {
            right = `'${generateExpression(expression.right, ctx)}'`
        } else {
            right = generateExpression(expression.right, ctx)
        }
        if ((typeof(left) === 'string' || typeof(right) === 'string') && (expression.operator == '*' || expression.operator == '-' || expression.operator == '/')) {
            throw new Error (`Invalid Operation: (${left} ${expression.operator} ${right})`)
        } else {
            result = eval(left + expression.operator + right)
            return result
        }
    }
    else {
        throw new Error ('Unhandled Expression type: ' + expression.$type)
    }
}

function generateParameters(expression: Expression[], ctx:GeneratorContext):string {
    let result = ''
    expression.forEach(el => {
        let currentExpression = ''
        if (isNumberExpression(el) === true) {
            currentExpression = `${generateExpression(el, ctx)}`
        } else {
            currentExpression = `"${generateExpression(el, ctx)}"`
        }
        if (result === '') {
            result = currentExpression
        } else {
            result = `${result}, ${currentExpression}`
        }
    })
    return result
}

function generateInlineCSS(element: (CSSElements), ctx:GeneratorContext):string {
    let cssString = ''
    element.css.forEach(cssel => {
        switch (cssel.property){
            case 'text-color':
                cssString += `color:${generateExpression(cssel.value, ctx)}; `
                break;
            case 'font-size':
                cssString += `font-size:${generateExpression(cssel.value, ctx)}; `
                break;
            case 'height':
                cssString += `height:${generateExpression(cssel.value, ctx)}; `
                break;
            case 'width':
                cssString += `width:${generateExpression(cssel.value, ctx)}; `
                break
            case 'background-color':
                cssString += `background-color: ${generateExpression(cssel.value, ctx)}; `
                break
        }
    })
    return cssString
}

// Check for Type and call head functions
export function generateHead(model: SimpleUi, bodyNode: CompositeGeneratorNode, ctx:GeneratorContext) {
    const suiTypes = reflection.getAllTypes();
    model.headelements.forEach(el => {
        suiTypes.forEach(suiType => {
            const t = suiType as SimpleUIAstType;
            const isInstance = reflection.isInstance(el, t);
            if(isInstance) {
                const func = generateHeadFunctions[t];
                if(func) {
                    const content = func(el, ctx);
                    bodyNode.append(content, NL);
                }
            }
        })
    })
}

// Check for Type and call body functions
export function generateBody(model: SimpleUi, bodyNode: CompositeGeneratorNode, ctx:GeneratorContext) {
    const suiTypes = reflection.getAllTypes();
    model.bodyelements.forEach(el => {
        suiTypes.forEach(suiType => {
            const t = suiType as SimpleUIAstType;
            const isInstance = reflection.isInstance(el, t);
            if(isInstance) {
                const func = generateBodyFunctions[t];
                if(func) {
                    const content = func(el, ctx);                
                    bodyNode.append(content, NL);
                }
            }
        })
    })
}
// Check for Type and call body functions
export function generateComponent(model: SimpleUi, bodyNode: CompositeGeneratorNode, ctx:GeneratorContext) {
    const suiTypes = reflection.getAllTypes();
    model.bodyelements.forEach(el => {
        suiTypes.forEach(suiType => {
            const t = suiType as SimpleUIAstType;
            const isInstance = reflection.isInstance(el, t);
            if(isInstance) {
                const func = generateBodyFunctions[t];
                if(func) {
                    const content = func(el, ctx);
                    bodyNode.append(content, NL);
                }
            }
        })
    })
}
