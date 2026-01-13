# XML to JSON Conversion API

## Endpoint
```
POST /api/convert/xml-to-json
```

## Headers
```
Content-Type: application/json
Authorization: Bearer {access_token}
```

## Request Body
```json
{
  "xmlContent": "<?xml version=\"1.0\"?><root><item>value</item></root>",
  "options": {
    "preserveAttributes": true,
    "outputFormat": "pretty",
    "fileType": "generic"
  }
}
```

## Response
```json
{
  "success": true,
  "jsonOutput": "{\n  \"name\": \"root\",\n  \"content\": {\n    \"item\": \"value\"\n  }\n}",
  "conversionTime": 45,
  "fileType": "generic"
}
```

## Error Response
```json
{
  "success": false,
  "error": "Invalid XML format",
  "code": "XML_PARSE_ERROR"
}
```

## Token Refresh
```
POST /api/refresh-token
Content-Type: application/json

{
  "refreshToken": "your_refresh_token_here"
}
```