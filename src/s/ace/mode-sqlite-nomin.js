define("ace/mode/sql_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    var SqlHighlightRules = function() {

        var keywords = (
            "abort|action|add|after|all|alter|analyze|and|as|asc|attach|autoincrement|before|begin|between|by|cascade|case|cast|check|collate|column|commit|conflict|constraint|create|cross|current|current_date|current_time|current_timestamp|database|default|deferrable|deferred|delete|desc|detach|distinct|do|drop|each|else|end|escape|except|exclude|exclusive|exists|explain|fail|filter|following|for|foreign|from|full|glob|group|groups|having|if|ignore|immediate|in|index|indexed|initially|inner|insert|instead|intersect|into|is|isnull|join|key|left|like|limit|match|natural|no|not|nothing|notnull|null|of|offset|on|or|order|others|outer|over|partition|plan|pragma|preceding|primary|query|raise|range|recursive|references|regexp|reindex|release|rename|replace|restrict|right|rollback|row|rows|savepoint|select|set|table|temp|temporary|then|ties|to|transaction|trigger|unbounded|union|unique|update|using|vacuum|values|view|virtual|when|where|window|with|without"
        );

        var builtinConstants = (
            "true|false"
        );

        var builtinFunctions = (
            "abs|avg|changes|char|coalesce|count|date|datetime|glob|group_concat|hex|ifnull|instr|julianday|last_insert_rowid|length|like|likelihood|likely|lower|ltrim|max|min|nullif|printf|quote|random|randomblob|replace|round|rtrim|soundex|strftime|substr|sum|time|total|total_changes|trim"
        );

        var dataTypes = (
            "blob|boolean|character|date|datetime|decimal|double|float|int|integer|numeric|real|text|varchar"
        );

        var keywordMapper = this.createKeywordMapper({
            "support.function": builtinFunctions,
            "keyword": keywords,
            "constant.language": builtinConstants,
            "storage.type": dataTypes
        }, "identifier", true);

        this.$rules = {
            "start" : [ {
                token : "comment",
                regex : "--.*$"
            },  {
                token : "comment",
                start : "/\\*",
                end : "\\*/"
            }, {
                token : "string",           // " string
                regex : '".*?"'
            }, {
                token : "string",           // ' string
                regex : "'.*?'"
            }, {
                token : "string",           // ` string (apache drill)
                regex : "`.*?`"
            }, {
                token : "constant.numeric", // float
                regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"
            }, {
                token : keywordMapper,
                regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
            }, {
                token : "keyword.operator",
                regex : "\\+|\\-|\\/|\\/\\/|%|<@>|@>|<@|&|\\^|~|<|>|<=|=>|==|!=|<>|="
            }, {
                token : "paren.lparen",
                regex : "[\\(]"
            }, {
                token : "paren.rparen",
                regex : "[\\)]"
            }, {
                token : "text",
                regex : "\\s+"
            } ]
        };
        this.normalizeRules();
    };

    oop.inherits(SqlHighlightRules, TextHighlightRules);

    exports.SqlHighlightRules = SqlHighlightRules;
});

define("ace/mode/sql",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/sql_highlight_rules"], function(require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextMode = require("./text").Mode;
    var SqlHighlightRules = require("./sql_highlight_rules").SqlHighlightRules;

    var Mode = function() {
        this.HighlightRules = SqlHighlightRules;
        this.$behaviour = this.$defaultBehaviour;
    };
    oop.inherits(Mode, TextMode);

    (function() {

        this.lineCommentStart = "--";

        this.$id = "ace/mode/sql";
    }).call(Mode.prototype);

    exports.Mode = Mode;

});                (function() {
    window.require(["ace/mode/sql"], function(m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();

