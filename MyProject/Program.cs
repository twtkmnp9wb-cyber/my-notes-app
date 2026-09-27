Console.WriteLine("--- Задача 1: Расчет времени покраски забора ---");

double speed = 22.0; // м^2 в час
double height = 3.0; // высота забора

Console.Write("Введите длину участка (м): ");
double length = double.Parse(Console.ReadLine());

Console.Write("Введите ширину участка (м): ");
double width = double.Parse(Console.ReadLine());

double perimeter = 2 * (length + width);
double fenceArea = perimeter * height;

double time = fenceArea / speed;
Console.WriteLine($"Время на покраску: {time} часов\n");