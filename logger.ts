import * as winston from "winston"
import * as filesis from "fs"
import lodash from "lodash";

//const lodash = require('lodash');
let conf = require('./../../config/logConfig.json');
const defaultConfig = conf.development;
const environment = process.env.envTarget || 'development';
const environmentConfig = conf[environment];
const finalConfig = lodash.merge(defaultConfig, environmentConfig);

export class Logger {
    private static instance: any;
    private logger: any = null;
    private loggerElk: any = null;
    private currentLogLevel: number;
    private logLevels: any = {
        emerg: 0,
        alert: 1,
        crit: 2,
        error: 3,
        warning: 4,
        notice: 5,
        info: 6,
        debug: 7
    };
    private constructor() {
        if (!filesis.existsSync(finalConfig.logDir))
            filesis.mkdirSync(finalConfig.logDir);
        this.currentLogLevel = this.logLevels[finalConfig.logLevelAtStart];
        this.logger = this.createLogger(finalConfig.appName, this.setLoggerFormat());
        this.loggerElk = this.createElkLogger(finalConfig.appName, this.setLoggerElkFormat());
    }
    public static getInstance() {
        return this.instance || (this.instance = new this());
    }
    /**
     * There is 2 ways for logging:
     *  - by sending only one parameter as json structure
     *      - ex: log({"level": "info", "message":"message"})
     *  - by filling the parameters you want to log\n
     *      - ex: log('info', 'message', null, 'START')
     */
    public log(lvl: any, message?: string, insured_person?: number, operation?: string, route?: string, data?: any) {
        if (arguments.length == 1 && this.logLevels[lvl.level] <= this.currentLogLevel) { //to log with a JSON structure
            if (!(lvl.level) || !(lvl.message))
                return false
            let json = {
                "message": lvl.message,
                "operation": lvl.operation,
                "route": lvl.route,
                "account_id": lvl.insured_person,
                "data": lvl.data
            }
            this.logger.log.apply(this.logger, [lvl.level, json]);
            this.loggerElk.log.apply(this.loggerElk, [lvl.level, json]);
            return true;
        }
        else if (this.logLevels[arguments[0]] <= this.currentLogLevel) { // to log with arguments
            let json = {
                "message": message,
                "operation": operation,
                "route": route,
                "account_id": insured_person,
                "data": data
            }
            this.logger.log.apply(this.logger, [lvl, json]);
            this.loggerElk.log.apply(this.loggerElk, [lvl, json]);
            return true;
        }
        return false;
    }
    public update(level: string) {
        this.currentLogLevel = this.logLevels[level];
    }
    public getLogLevels() {
        return this.logLevels;
    }
    private createLogger(filename: string, myFormat: any) {
        let logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.colorize({ all: finalConfig.colorize }),
                winston.format.timestamp({ format: finalConfig.timeFormat }),
                myFormat
            ),
            transports: [
                new winston.transports.Console({
                    level: Object.keys(this.logLevels)[this.currentLogLevel]
                }),
                new winston.transports.File({
                    filename: finalConfig.logDir + '/' + filename + '.log',
                    level: Object.keys(this.logLevels)[this.currentLogLevel],
                    handleExceptions: true,
                    maxsize: finalConfig.maxFileSize,
                    maxFiles: finalConfig.maxFiles,
                })
            ],
            levels: this.logLevels
        });
        return logger
    }
    private createElkLogger(filename: string, myFormat: any) {
        let logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp({ format: finalConfig.timeFormat }),
                myFormat
            ),
            transports: [
                new winston.transports.File({
                    filename: finalConfig.logDir + '/' + filename + '-ELK.log',
                    level: Object.keys(this.logLevels)[this.currentLogLevel],
                    handleExceptions: true,
                    maxsize: finalConfig.maxFileSize,
                    maxFiles: finalConfig.maxFiles,
                })
            ],
            levels: this.logLevels
        });
        return logger
    }
    private buildJson(d: any) {
        var json: any = {
            "timestamp": d.timestamp,
            "level": d.level,
            "label": finalConfig.appName
        }
        if (d.operation)
            json["operation"] = d.operation;
        if (d.route)
            json['route'] = d.route;
        if (d.account_id)
            json['insured_person'] = d.account_id;
        if (d.data)
            this.isJson(d.data) ? json['data'] = JSON.parse(d.data) : json['data'] = d.data;
        if (d.message)
            json['message'] = d.message;
        return JSON.stringify(json);
    }
    private setLoggerFormat() {
        let format = winston.format.printf(log => {
            return `${log.timestamp} - ${finalConfig.appName} - [${log.level}] - ${log.account_id ? log.account_id + ' - ' : ''}${log.operation ? log.operation + ' - ' : ''}${log.route ? log.route + ' - ' : ''}${log.message}${log.data ? this.isJson(log.data) ? log.data + ' - ' : '\n' + JSON.stringify(log.data, null, '\t') : ''}`
        });
        return format;
    }
    /**
     * Custom rules for la cipav logging
     * allowed:
     *  - START custom operation (we want the 'start' label and a message)
     *  - complete log operation (with loglvl, operation, route, adherent, message)
     *  - a simple log (with loglvl and a message)
     */
    private setLoggerElkFormat() {
        let format = winston.format.printf(log => {
            return `${this.buildJson(log)}`;
        });
        return format;
    }
    private isJson(str: any) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }
}
