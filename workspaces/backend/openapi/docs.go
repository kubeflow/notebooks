// Package openapi Code generated by swaggo/swag. DO NOT EDIT
package openapi

import "github.com/swaggo/swag"

const docTemplate = `{
    "schemes": {{ marshal .Schemes }},
    "swagger": "2.0",
    "info": {
        "description": "{{escape .Description}}",
        "title": "{{.Title}}",
        "contact": {},
        "license": {
            "name": "License: Apache 2.0",
            "url": "http://www.apache.org/licenses/LICENSE-2.0.html"
        },
        "version": "{{.Version}}"
    },
    "host": "{{.Host}}",
    "basePath": "{{.BasePath}}",
    "paths": {
        "/healthcheck": {
            "get": {
                "description": "Provides a healthcheck response indicating the status of key services.",
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "healthcheck"
                ],
                "summary": "Returns the health status of the application",
                "responses": {
                    "200": {
                        "description": "Successful healthcheck response",
                        "schema": {
                            "$ref": "#/definitions/health_check.HealthCheck"
                        }
                    },
                    "500": {
                        "description": "Internal server error",
                        "schema": {
                            "$ref": "#/definitions/api.ErrorEnvelope"
                        }
                    }
                }
            }
        }
    },
    "definitions": {
        "api.ErrorCause": {
            "type": "object",
            "properties": {
                "validation_errors": {
                    "type": "array",
                    "items": {
                        "$ref": "#/definitions/api.ValidationError"
                    }
                }
            }
        },
        "api.ErrorEnvelope": {
            "type": "object",
            "properties": {
                "error": {
                    "$ref": "#/definitions/api.HTTPError"
                }
            }
        },
        "api.HTTPError": {
            "type": "object",
            "properties": {
                "cause": {
                    "$ref": "#/definitions/api.ErrorCause"
                },
                "code": {
                    "type": "string"
                },
                "message": {
                    "type": "string"
                }
            }
        },
        "api.ValidationError": {
            "type": "object",
            "properties": {
                "field": {
                    "type": "string"
                },
                "message": {
                    "type": "string"
                },
                "type": {
                    "$ref": "#/definitions/field.ErrorType"
                }
            }
        },
        "field.ErrorType": {
            "type": "string",
            "enum": [
                "FieldValueNotFound",
                "FieldValueRequired",
                "FieldValueDuplicate",
                "FieldValueInvalid",
                "FieldValueNotSupported",
                "FieldValueForbidden",
                "FieldValueTooLong",
                "FieldValueTooMany",
                "InternalError",
                "FieldValueTypeInvalid"
            ],
            "x-enum-varnames": [
                "ErrorTypeNotFound",
                "ErrorTypeRequired",
                "ErrorTypeDuplicate",
                "ErrorTypeInvalid",
                "ErrorTypeNotSupported",
                "ErrorTypeForbidden",
                "ErrorTypeTooLong",
                "ErrorTypeTooMany",
                "ErrorTypeInternal",
                "ErrorTypeTypeInvalid"
            ]
        },
        "health_check.HealthCheck": {
            "type": "object",
            "properties": {
                "status": {
                    "$ref": "#/definitions/health_check.ServiceStatus"
                },
                "system_info": {
                    "$ref": "#/definitions/health_check.SystemInfo"
                }
            }
        },
        "health_check.ServiceStatus": {
            "type": "string",
            "enum": [
                "Healthy",
                "Unhealthy"
            ],
            "x-enum-varnames": [
                "ServiceStatusHealthy",
                "ServiceStatusUnhealthy"
            ]
        },
        "health_check.SystemInfo": {
            "type": "object",
            "properties": {
                "version": {
                    "type": "string"
                }
            }
        }
    }
}`

// SwaggerInfo holds exported Swagger Info so clients can modify it
var SwaggerInfo = &swag.Spec{
	Version:          "1.0.0",
	Host:             "localhost:4000",
	BasePath:         "/api/v1",
	Schemes:          []string{"http", "https"},
	Title:            "Kubeflow Notebooks API",
	Description:      "This API provides endpoints to manage notebooks in a Kubernetes cluster.\nFor more information, visit https://www.kubeflow.org/docs/components/notebooks/",
	InfoInstanceName: "swagger",
	SwaggerTemplate:  docTemplate,
	LeftDelim:        "{{",
	RightDelim:       "}}",
}

func init() {
	swag.Register(SwaggerInfo.InstanceName(), SwaggerInfo)
}
