using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace LaunchPad.Models
{
    public class CategoryRole
    {
        public int CategoryId { get; set; }
        public Category Category { get; set; }

        public int RoleId { get; set; }
        public Role Role { get; set; }
    }
}
