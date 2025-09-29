# Delete a model response 
`DELETE https://api.openai.com/v1/responses/{response_id}`

Deletes a model response with the given ID.

## Path parameters

| Name | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| response_id | string | Required | The ID of the response to delete. |

## Returns

- A success message.

## Example Request

```curl
curl -X DELETE https://api.openai.com/v1/responses/resp_123 \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY"

```

```js
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.delete("resp_123");
console.log(response);

```

```python
from openai import OpenAI
client = OpenAI()

response = client.responses.delete("resp_123")
print(response)

```

## Example Response

```json
{
  "id": "resp_6786a1bec27481909a17d673315b29f6",
  "object": "response",
  "deleted": true
}

```
