"""Vantage API Tests — run against a live server (sequential)"""
import httpx

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
        "id": 1,
        "title": "Learn Keploy and Vantage"
    },
    {
        "id": 2,
        "title": "Build Vantage"
    }
]

def test_post_api_todos_1():
    """POST /api/todos — recorded by Vantage"""
    response = httpx.post(
        f"{BASE_URL}/api/todos",
        headers={
    "content-type": "application/json",
    "accept": "*/*"
},
        json={
    "title": "Play Cricket"
},
    )

    assert response.status_code == 201
    assert response.json() == {
    "id": 3,
    "title": "Play Cricket"
}

def test_post_api_todos_2():
    """POST /api/todos — recorded by Vantage"""
    response = httpx.post(
        f"{BASE_URL}/api/todos",
        headers={
    "content-type": "application/json",
    "accept": "*/*"
},
        json={
    "title": "Watch Movies"
},
    )

    assert response.status_code == 201
    assert response.json() == {
    "id": 4,
    "title": "Watch Movies"
}

def test_put_api_todos_1():
    """PUT /api/todos — recorded by Vantage"""
    response = httpx.put(
        f"{BASE_URL}/api/todos",
        headers={
    "content-type": "application/json",
    "accept": "*/*"
},
        json={
    "id": 1,
    "title": "Learn Cooking"
},
    )

    assert response.status_code == 404

def test_put_api_todos_1_1():
    """PUT /api/todos/1 — recorded by Vantage"""
    response = httpx.put(
        f"{BASE_URL}/api/todos/1",
        headers={
    "content-type": "application/json",
    "accept": "*/*"
},
        json={
    "title": "Learn Cooking"
},
    )

    assert response.status_code == 200
    assert response.json() == {
    "id": 1,
    "title": "Learn Cooking"
}

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
        "id": 1,
        "title": "Learn Cooking"
    },
    {
        "id": 2,
        "title": "Build Vantage"
    },
    {
        "id": 3,
        "title": "Play Cricket"
    },
    {
        "id": 4,
        "title": "Watch Movies"
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

def test_get_api_todos_3():
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
        "id": 1,
        "title": "Learn Cooking"
    },
    {
        "id": 2,
        "title": "Build Vantage"
    },
    {
        "id": 3,
        "title": "Play Cricket"
    }
]

