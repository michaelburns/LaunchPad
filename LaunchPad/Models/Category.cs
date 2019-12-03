using System.Collections.Generic;

namespace LaunchPad.Models
{
    public class Category
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public IEnumerable<CategoryRole> CategoryRoles { get; set; }
    }
}
