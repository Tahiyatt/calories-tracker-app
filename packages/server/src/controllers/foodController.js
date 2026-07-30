import * as foods from '../services/foodService.js';

export async function search(req, res) {
  const { q, limit, remote } = req.validatedQuery;
  res.json(await foods.search({ q, limit, remote }));
}

export async function byBarcode(req, res) {
  const result = await foods.findByBarcode(req.params.barcode);

  if (!result.food) {
    return res.status(404).json({
      error: result.rejected ?? 'No product found for that barcode',
    });
  }

  res.json(result);
}

export async function createUserFood(req, res) {
  res.status(201).json({ food: await foods.createUserFood(req.body, req.user) });
}
