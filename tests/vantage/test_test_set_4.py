"""Vantage API Tests — run against a live server (sequential)"""
import httpx

class _AnyType:
    def __init__(self, t):
        self.t = t
    def __eq__(self, other):
        return isinstance(other, self.t)

ANY_STR = _AnyType(str)
ANY_NUM = _AnyType((int, float))
ANY_BOOL = _AnyType(bool)
ANY_LIST = _AnyType(list)

BASE_URL = "http://localhost:3000"

def test_get_api_todos_1():
    """GET /api/todos — recorded by Vantage"""
    response = httpx.get(
        f"{BASE_URL}/api/todos",
        headers={
    "accept": "*/*"
},
    )

    assert response.status_code == 200
    assert response.json() == [
    {
        "id": ANY_NUM,
        "title": "Learn Keploy and Vantage"
    },
    {
        "id": ANY_NUM,
        "title": "Build Vantage"
    }
]

def test_delete_api_todos_4_1():
    """DELETE /api/todos/4 — recorded by Vantage"""
    response = httpx.delete(
        f"{BASE_URL}/api/todos/4",
        headers={
    "accept": "*/*"
},
    )

    assert response.status_code == 204

def test_get_api_todos_2():
    """GET /api/todos — recorded by Vantage"""
    response = httpx.get(
        f"{BASE_URL}/api/todos",
        headers={
    "accept": "*/*"
},
    )

    assert response.status_code == 200
    assert response.json() == [
    {
        "id": ANY_NUM,
        "title": "Learn Keploy and Vantage"
    },
    {
        "id": ANY_NUM,
        "title": "Build Vantage"
    }
]

def test_put_api_todos_10_1():
    """PUT /api/todos/10 — recorded by Vantage"""
    response = httpx.put(
        f"{BASE_URL}/api/todos/10",
        headers={
    "content-type": "application/json",
    "accept": "*/*"
},
        json={
    "title": "Learn Cooking"
},
    )

    assert response.status_code == 404
    assert response.json() == {
    "error": "Todo not found"
}

def test_post_api_todos_1():
    """POST /api/todos — recorded by Vantage"""
    response = httpx.post(
        f"{BASE_URL}/api/todos",
        headers={
    "content-type": "application/json",
    "accept": "*/*"
},
        json={
    "ttle": "Watch Movies"
},
    )

    assert response.status_code == 201
    assert response.json() == {
    "id": ANY_NUM
}

